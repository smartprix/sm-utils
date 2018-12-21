import Redis from 'ioredis';
import timestring from 'timestring';
import {Observer} from 'micro-observer';
import _ from 'lodash';
import util from 'util';
import LRU from './LRU';
import Cache from './Cache';

const DELETE = Symbol('DELETE');
const DEL_CONTAINS = Symbol('DEL_CONTAINS');
const CLEAR = Symbol('CLEAR');
const redisMap = {};
const globalLocalCache = new Map();
globalLocalCache.set('*', new Map());
const processId = process.pid;
const getting = new Map();
const setting = new Map();
const getOrSetting = new Map();
const getOrSettingStale = new Map();

const tick = util.promisify(setImmediate);

// delete expired values from local cache
async function gcLocalCacheAsync() {
	let i = 0;
	const time = Date.now();
	for (const [, cache] of globalLocalCache) {
		for (const [key, value] of cache) {
			if (value.t && (time - value.c > value.t)) {
				// value is expired
				cache.delete(key);
			}

			i++;
			if ((i & 32767) === 0) {
				// allow other tasks to execute after every 32768 elements
				// eslint-disable-next-line no-await-in-loop
				await tick();
			}
		}
	}
}

function gcLocalCache() {
	gcLocalCacheAsync().then(() => {}, err => console.error(err));
}

// delete all keys containing a pattern
function localCacheDelContains(cache, pattern, prefix) {
	if (prefix === '*') {
		// delete for all caches
		globalLocalCache.forEach((lCache) => {
			localCacheDelContains(lCache, pattern);
		});

		return;
	}

	if (pattern === '_all_') {
		// clear the cache
		cache.clear();
		return;
	}

	if (pattern.includes('*')) {
		let keyRegex;
		if (pattern === '*') {
			keyRegex = new RegExp(pattern.replace('*', '.*'));
		}
		else {
			keyRegex = new RegExp(`^${this.prefix}:.*${pattern.replace('*', '.*')}`);
		}

		// use for loop because LRU doesn't support forEach yet
		for (const [, key] of cache) {
			if (keyRegex.test(key)) {
				cache.delete(key);
			}
		}

		return;
	}

	// simple deletion
	// use for loop because LRU doesn't support forEach yet
	for (const [key] of cache) {
		if (key.includes(pattern)) {
			cache.delete(key);
		}
	}
}

async function _withDefault(promise, defaultValue) {
	const value = await promise;
	if (value === undefined) return defaultValue;
	return value;
}

function parseTTL(ttl) {
	if (typeof ttl === 'string') return timestring(ttl, 'ms');
	return ttl;
}

// Garbage collection of local cache
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const gcTimer = setInterval(gcLocalCache, FIFTEEN_MINUTES);
gcTimer.unref(); // unref gc timer so it allows process to exit

/**
 * Cache backed by Redis
 * @class
 */
class RedisCache {
	static globalPrefix = 'a';
	static redisGetCount = 0;
	static useLocalCache = true;
	static logger = console;
	static _bypass = false;
	// this causes performace issues, use only when debugging
	static logOnLocalWrite = false;

	// default redis configuration
	static defaultRedisConf = {
		host: '127.0.0.1',
		port: 6379,
		password: undefined,
	};

	// which server to use for pub / sub (sync of local cache)
	// we need to use a different server because main server might
	// have bad pubsub performance (eg. pika)
	static pubSubRedisConf = {};

	/**
	 * @ignore
	 * @typedef {object} redisConf
	 * @property {string} host
	 * @property {number} port
	 * @property {string} [auth]
	 * @property {string} [password]
	 * @property {string} [type] type of server ('redis' or 'pika')
	 */

	/**
	 * @param {string} prefix
	 * @param {Redis|redisConf} redisConf
	 * @param {object} [options={}] These options can also be set on a global level
	 * @param {boolean} [options.useLocalCache]
	 * @param {boolean} [options.logOnLocalWrite] Enable/disable logs on writes to local cache object
	 * @param {object} [options.logger] Custom logger to use instead of console
	 */
	constructor(prefix, redisConf = {}, options = {}) {
		this.prefix = prefix;
		this.logger = options.logger || this.constructor.logger;
		this.logOnLocalWrite = options.logOnLocalWrite || this.constructor.logOnLocalWrite;

		if (redisConf instanceof Redis) {
			this.redis = redisConf;
			return;
		}

		// Use merge because it ignores undefined values unlike Object.assign
		const redis = _.merge({}, this.constructor.defaultRedisConf, {
			host: redisConf.host,
			port: redisConf.port,
			password: redisConf.password || redisConf.auth,
		});

		// whether we are using pika
		const type = redisConf.type || this.constructor.defaultRedisConf.type;
		this.isPika = (type === 'pika');

		/** @type [{Redis}, {Redis}] */
		[this.redis, this.pubRedis] = this.constructor.getRedis(redis);

		if ('useLocalCache' in redisConf) {
			this.useLocalCache = redisConf.useLocalCache;
		}
		else if ('useLocalCache' in options) {
			this.useLocalCache = options.useLocalCache;
		}
		else {
			this.useLocalCache = this.constructor.useLocalCache;
		}

		this.localCache = globalLocalCache.get(this.prefix);
		if (!this.localCache) {
			if (options.maxLocalItems) {
				// LRU
				this.localCache = new LRU({maxItems: options.maxLocalItems});
			}
			else {
				this.localCache = new Map();
			}

			globalLocalCache.set(this.prefix, this.localCache);
		}
	}

	/**
	 * @param {redisConf} redisConf
	 */
	static getRedis(redisConf) {
		const address = `${redisConf.host}:${redisConf.port}`;

		// cache redis connections in a map to prevent a new connection on each instance
		if (!redisMap[address]) {
			const redis = new Redis(redisConf);

			redis.on('error', (err) => {
				this.logger.error(`[RedisCache] error in redis connection on ${address}`, err);
			});

			// we need a different connection for subscription, because once subscribed
			// no other commands can be issued
			const pubRedis = this.subscribe(redisConf);

			redisMap[address] = [redis, pubRedis];
		}

		return redisMap[address];
	}

	/**
	 * @param {redisConf} redisConf
	 */
	static subscribe(redisConf) {
		const pubSubConf = {};
		pubSubConf.host = this.pubSubRedisConf.host || redisConf.host;
		pubSubConf.port = this.pubSubRedisConf.port || redisConf.port;
		if (this.pubSubRedisConf.password) {
			pubSubConf.password = this.pubSubRedisConf.password;
		}
		else if (redisConf.password && _.isEmpty(this.pubSubRedisConf)) {
			pubSubConf.password = redisConf.password;
		}

		const subRedis = new Redis(pubSubConf);
		const pubRedis = new Redis(pubSubConf);

		subRedis.on('error', (err) => {
			this.logger.error(`[RedisCache] error in redis connection on ${redisConf.host}:${redisConf.port}`, err);
		});

		const channelName = `RC:${this.globalPrefix}`;

		subRedis.subscribe(channelName, (err) => {
			if (err) {
				this.logger.error(`[RedisCache] can't subscribe to channel ${channelName}`, err);
			}
		});

		subRedis.on('message', this.handleSubscribeMessage.bind(this));

		return pubRedis;
	}

	static handleSubscribeMessage(channel, message) {
		// the channel is RC:${globalPrefix} => RC:a
		// the message is ${pid}\v${prefix}\v${command}\v${args.join('\v')}
		const [pid, prefix, command, key, ...args] = message.split('\v');

		// const debugMsg = `${command} ${prefix}:${key} [from ${pid} to ${processId}]`;
		// RedisCache.logger.log(`[RedisCache] received subscribe command ${debugMsg}`);

		if (Number(pid) === processId) {
			// since the message came from the same process, it's already been handled
			// we don't need to do anything
			// RedisCache.logger
			// .log(`[RedisCache] ignored subscribe command ${command} from same process`);
			return;
		}

		if (command === 'delete' || command === 'setdel') {
			this._localCache(prefix, key, DELETE);
		}
		else if (command === 'clear') {
			this._localCache(prefix, '', CLEAR);
		}
		else if (command === 'del_contains') {
			this._localCache(prefix, key, DEL_CONTAINS);
		}
		else if (command === 'set') {
			// NOTE: set command is not being used currently
			try {
				const value = JSON.parse(args[0]);
				this._localCache(prefix, key, value);
			}
			catch (e) {
				console.error(e);
			}
		}
		else {
			this.logger.error(`[RedisCache] unknown subscribe command ${command}`);
		}
	}

	// get prefixed key for redis
	_key(key) {
		return `RC:${this.constructor.globalPrefix}:${this.prefix}:${key}`;
	}

	async _get(key) {
		this.constructor.redisGetCount++;
		const prefixedKey = this._key(key);
		const value = await this.redis.get(prefixedKey);
		if (value === null) return undefined;
		try {
			return JSON.parse(value);
		}
		catch (err) {
			return value;
		}
	}

	async _has(key) {
		return this.redis.exists(this._key(key));
	}

	_set(key, value, ttl = 0) {
		if (value === undefined) return true;
		const prefixedKey = this._key(key);

		if (ttl <= 0) {
			return this.redis.set(prefixedKey, JSON.stringify(value));
		}

		return this.redis.set(prefixedKey, JSON.stringify(value), 'PX', ttl);
	}

	_setLocal(key, value, ttl = 0) {
		if (value === undefined) return;

		const data = {
			c: Date.now(),
			v: value,
		};

		if (ttl > 0) {
			data.t = ttl;
		}

		this._localCache(key, data, false);
	}

	_setBoth(key, value, ttl = 0) {
		if (value === undefined) return true;

		const data = {
			c: Date.now(),
			v: value,
		};

		if (ttl > 0) {
			data.t = ttl;
		}

		if (this.useLocalCache) {
			this._localCache(key, data);
		}

		return this._set(key, data, ttl);
	}

	_del(key) {
		if (this.isPika) {
			// pika does not support unlink command
			return this.redis.del(this._key(key));
		}

		return this.redis.unlink(this._key(key));
	}

	_delPattern(pattern) {
		if (this.isPika) {
			return this._delPatternPika(pattern);
		}

		return this.redis.eval(
			`local j=0; for i, name in ipairs(redis.call('KEYS', '${pattern}')) do redis.call('UNLINK', name); j=i end return j`,
			0,
		);
	}

	_actionPattern(pattern, action) {
		const stream = this.redis.scanStream({
			match: pattern,
			count: 100,
		});

		let count = 0;
		stream.on('data', async (keys) => {
			count += keys.length;
			if (action) {
				try {
					await action(keys);
				}
				catch (e) {
					this.logger.error(e);
				}
			}
		});

		return new Promise((resolve) => {
			stream.on('end', () => resolve(count));
		});
	}

	_delPatternPika(pattern) {
		// Pika does not support lua
		// We have to use scan for deleting keys
		return this._actionPattern(pattern, keys => (keys.length && this.redis.del(...keys)));
	}

	_countPattern(pattern) {
		if (this.isPika) {
			return this._countPatternPika(pattern);
		}

		return this.redis.eval(`return #redis.pcall('keys', '${pattern}')`, 0);
	}

	_countPatternPika(pattern) {
		// Pika does not support lua
		// We have to use scan for counting keys
		return this._actionPattern(pattern);
	}

	_clear() {
		const keyGlob = this._key('*');
		return this._delPattern(keyGlob);
	}

	_size() {
		const keyGlob = this._key('*');
		return this._countPattern(keyGlob);
	}

	// eslint-disable-next-line max-statements
	static _localCache(prefix, key, value) {
		const cache = globalLocalCache.get(prefix);
		if (!cache) return undefined;

		// delete key
		if (value === DELETE) {
			return cache.delete(key);
		}

		// clear cache
		if (value === CLEAR) {
			return cache.clear();
		}

		// delete keys containing a pattern
		if (value === DEL_CONTAINS) {
			return localCacheDelContains(cache, key, prefix);
		}

		return undefined;
	}

	_localCachePublish(command, key = 'null') {
		// the channel is RC:${globalPrefix} => RC:a
		// the message is ${pid}\v${prefix}\v${command}\v${args.join('\v')}

		const channelName = `RC:${this.constructor.globalPrefix}`;
		const message = `${processId}\v${this.prefix}\v${command}\v${key}`;
		this.pubRedis.publish(channelName, message);
	}

	_localCache(key, value, publish = true) {
		// get key
		if (value === undefined) {
			const res = this.localCache.get(key);
			if (res === undefined || !res.t) return res;
			if ((Date.now() - res.c) > res.t) {
				// value has expired
				this.localCache.delete(key);
				return undefined;
			}
			return res;
		}

		// delete key
		if (value === DELETE) {
			if (publish) this._localCachePublish('delete', key);
			this.localCache.delete(key);
			return undefined;
		}

		// clear cache
		if (value === CLEAR) {
			if (publish) this._localCachePublish('clear');
			this.localCache.clear();
			return undefined;
		}

		// delete keys containing a pattern
		if (value === DEL_CONTAINS) {
			if (publish) this._localCachePublish('del_contains', key);
			localCacheDelContains(this.localCache, key, this.prefix);
			return undefined;
		}

		// set key
		if (publish) this._localCachePublish('setdel', key);
		this.localCache.set(key, value);
		return value;
	}

	_fetching(map, key, value) {
		const prefixedKey = this._key(key);
		if (value === undefined) {
			return map.get(prefixedKey);
		}
		if (value === DELETE) {
			map.delete(prefixedKey);
			return undefined;
		}

		map.set(prefixedKey, value);
		return value;
	}

	_getting(key, value) {
		return this._fetching(getting, key, value);
	}

	_setting(key, value) {
		return this._fetching(setting, key, value);
	}

	_getOrSetting(key, value) {
		return this._fetching(getOrSetting, key, value);
	}

	_getOrSettingStale(key, value) {
		return this._fetching(getOrSettingStale, key, value);
	}

	/**
	 * bypass the cache and compute value directly (useful for debugging / testing)
	 * NOTE: this'll be only useful in getOrSet or memoize, get will still return from cache
	 * @example
	 * let i = 0;
	 * const cache = new RedisCache();
	 * await cache.getOrSet('a', () => ++i); // => 1
	 * await cache.getOrSet('a', () => ++i); // => 1 (returned from cache)
	 * cache.bypass(); // turn on bypassing
	 * await cache.getOrSet('a', () => ++i); // => 2 (cache bypassed)
	 * await cache.getOrSet('a', () => ++i); // => 3 (cache bypassed)
	 * cache.bypass(false); // turn off bypassing
	 * await cache.getOrSet('a', () => ++i); // => 1 (previous cache item)
	 * @param {boolean} [bypass=true] whether to bypass the cache or not
	 */
	bypass(bypass = true) {
		this._bypass = bypass;
	}

	/**
	 * gets whether the cache is bypassed or not
	 * @returns {boolean}
	 */
	isBypassed() {
		if (this._bypass !== undefined) {
			return this._bypass;
		}

		return this.constructor._bypass;
	}

	/**
	 * bypass the cache and compute value directly (useful for debugging / testing)
	 * NOTE: RedisCache.bypass will turn on bypassing for all instances of RedisCache
	 * For bypassing a particular instance, use [`instance.bypass()`]{@link RedisCache#bypass}
	 * @see [bypass]{@link RedisCache#bypass}
	 * @param {boolean} [bypass=true] default true
	 */
	static bypass(bypass = true) {
		this._bypass = bypass;
	}

	/**
	 * gets whether the cache is bypassed or not
	 * @returns {boolean}
	 */
	static isBypassed() {
		return this._bypass;
	}

	/**
	 * wrap a value in a Proxy object for debugging writes to it
	 * @param {string} key
	 * @param {any} localValue
	 * @returns {any}
	 * @private
	 */
	_wrapInProxy(key, localValue) {
		if (!this.logOnLocalWrite || !this.useLocalCache) return localValue;
		if (!localValue || typeof localValue !== 'object') return localValue;

		// log writes to the local object in case logOnLocalWrite is true
		const proxy = Observer.create(localValue, (change) => {
			if (change.type === 'set-prop' || change.type === 'delete-prop') {
				const stack = new Error().stack.split('\n').map(line => `  ${line.trim()}`).slice(3).join('\n');
				this.logger.log(`[RedisCache] Attempt to write to local object ${this._key(key)}.${change.path}\n${stack}`);
			}
			return true;
		});
		return proxy;
	}

	/**
	 * @typedef {object} getRedisOpts
	 * @property {(val: any) => Promise<any> | any} [parse] function to parse value fetched from redis
	 */

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} [defaultValue]
	 * @param {getRedisOpts} [options]
	 * @returns {Promise<any>}
	 */
	async getStale(key, defaultValue = undefined, options = {}, ctx = {}) {
		if (this.useLocalCache) {
			const localValue = this._localCache(key);
			if (localValue !== undefined && localValue.v !== undefined) {
				if (ctx.staleTTL) {
					if (localValue.c < Date.now() - ctx.staleTTL) {
						ctx.isStale = true;
					}
				}
				return localValue.v;
			}
		}

		const gettingPromise = this._getting(key);
		if (gettingPromise) {
			const [value] = await gettingPromise;
			if (value === undefined) return defaultValue;
			return value;
		}

		const promise = this._get(key).then(async (value) => {
			if (value === undefined) return [value, 0];
			if (ctx.staleTTL) {
				if (value.c < Date.now() - ctx.staleTTL) {
					ctx.isStale = true;
				}
			}
			if (options.parse) {
				return [await options.parse(value.v), value.t];
			}
			return [value.v, value.t];
		});

		this._getting(key, promise);
		const [value, ttl] = await promise;
		if (this.useLocalCache) {
			this._setLocal(key, value, ttl);
		}
		this._getting(key, DELETE);

		if (value === undefined) return defaultValue;
		return value;
	}

	/**
	 * gets a value from the cache
	 * @param {string} key
	 * @param {any} [defaultValue]
	 * @param {getRedisOpts} [options]
	 * @returns {Promise<any>}
	 */
	async get(key, defaultValue = undefined, options = {}) {
		const settingPromise = this._setting(key);
		if (settingPromise) {
			return _withDefault(settingPromise, defaultValue);
		}

		return this.getStale(key, defaultValue, options);
	}

	/**
	 * checks if a key exists in the cache
	 * @param {string} key
	 * @returns {boolean}
	 */
	async has(key) {
		return this._has(key);
	}

	/**
	 * sets a value in the cache
	 * avoids dogpiling if the value is a promise or a function returning a promise
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h')
	 * or opts (default: 0)
	 * @return {boolean}
	 */
	async set(key, value, options = {}, ctx = {}) {
		let ttl = (typeof options === 'object') ? options.ttl : options;
		ttl = parseTTL(ttl);

		try {
			if (value && value.then) {
				// value is a Promise
				// resolve it and then cache it
				this._setting(key, value);
				const resolvedValue = this._wrapInProxy(key, await value);
				await this._setBoth(key, resolvedValue, ttl);
				this._setting(key, DELETE);
				ctx.result = resolvedValue;
				return true;
			}
			if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return this.set(key, value(key), ttl, ctx);
			}

			// value is normal
			// just set it in the store
			value = this._wrapInProxy(key, value);
			this._setting(key, Promise.resolve(value));
			await this._setBoth(key, value, ttl);
			this._setting(key, DELETE);
			ctx.result = value;
			return true;
		}
		catch (error) {
			this.logger.error(`[RedisCache] error while setting key ${key}`, error);
			await this._del(key);
			this._setting(key, DELETE);
			return false;
		}
	}

	async _getOrSet(key, value, options = {}) {
		// key already exists, return it
		const existingValue = await this.getStale(key, undefined, options);
		if (existingValue !== undefined) {
			return existingValue;
		}

		// no value given, return undefined
		if (value === undefined) {
			return undefined;
		}

		const ctx = {};
		await this.set(key, value, options, ctx);
		return ctx.result;
	}

	/**
	 * @typedef {object} setRedisOpts
	 * @property {number|string} ttl in ms / timestring ('1d 3h') default: 0
	 * @property {number|string} staleTTL in ms / timestring ('1d 3h')
	 *  set this if you want stale values to be returned and generation in the background
	 *  values will be considered stale after this time period
	 * @property {boolean} [requireResult=true]
	 *  only valid if stale ttl is given
	 *  it true, this will return undefined and generate value in background if the key does not exist
	 *  if false, this will generate value in foreground if the key does not exist
	 * @property {boolean} [freshResult=false]
	 *  always return fresh value
	 *  only valid if stale ttl is given
	 *  if true, this will generate value in foreground if value is stale
	 *  if false, this will generate value in background (and return stale value) if value is stale
	 * @property {(val: any) => Promise<any> | any} parse function to parse value fetched from redis
	 */

	/**
	 * gets a value from the cache, or sets it if it doesn't exist
	 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 * @return {any}
	 */
	async getOrSet(key, value, options = {}) {
		if (options && options.staleTTL) {
			return this._getOrSetStale(key, value, options);
		}

		const settingPromise = this._getOrSetting(key);
		if (settingPromise) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			return settingPromise;
		}

		// cache is bypassed, return value directly
		if (this.isBypassed()) {
			if (typeof value === 'function') return value(key);
			return value;
		}

		// try to get the value from local cache first
		if (this.useLocalCache) {
			const localValue = this._localCache(key);
			if (localValue !== undefined && localValue.v !== undefined) {
				return localValue.v;
			}
		}

		const promise = this._getOrSet(key, value, options);
		this._getOrSetting(key, promise);
		const result = await promise;
		this._getOrSetting(key, DELETE);
		return result;
	}

	async _setBackground(key, value, options) {
		if (this._getOrSettingStale(key)) return;

		// regenerate value in the background
		this._getOrSettingStale(key, true);
		setImmediate(async () => {
			await this.set(key, value, options);
			this._getOrSettingStale(key, DELETE);
		});
	}

	async _getOrSetStale(key, value, options = {}) {
		// cache is bypassed, return value directly
		if (this.isBypassed()) {
			if (typeof value === 'function') return value(key);
			return value;
		}

		// try to get the value from local cache first
		const ctx = {
			staleTTL: parseTTL(options.staleTTL),
		};

		const existingValue = await this.getStale(key, undefined, options, ctx);
		// true = generate in bg, false = generate in fg, null = don't generate
		let generateInBg = true;
		if (existingValue === undefined) {
			if (options.requireResult !== false || options.freshResult) {
				generateInBg = false;
			}
		}
		else if (ctx.isStale) {
			if (options.freshResult) {
				generateInBg = false;
			}
		}
		else {
			generateInBg = null;
		}

		if (generateInBg === false) {
			// regenerate value in the foreground
			const setCtx = {};
			await this.set(key, value, options, setCtx);
			return setCtx.result;
		}

		if (generateInBg === true) {
			// regenerate value in the background
			this._setBackground(key, value, options);
		}

		return existingValue;
	}

	_getLocalAttachedMap(key) {
		let value = this._localCache(key);
		if (value === undefined) {
			value = {
				a: new Map(),
			};

			this._localCache(key, value, false);
		}
		else if (value.a === undefined) {
			value.a = new Map();
		}

		return value.a;
	}

	/**
	 * attach and return a local map to the redis cache key
	 * the local map would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @return {Map}
	 */
	attachMap(key, mapKey) {
		const fullMap = this._getLocalAttachedMap(key);
		let map = fullMap.get(mapKey);
		if (!map) {
			map = new Map();
			fullMap.set(mapKey, map);
		}
		return map;
	}

	/**
	 * attach and return a local set to the redis cache key
	 * the local set would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @return {Set}
	 */
	attachSet(key, mapKey) {
		const fullMap = this._getLocalAttachedMap(key);
		let set = fullMap.get(mapKey);
		if (!set) {
			set = new Set();
			fullMap.set(mapKey, set);
		}
		return set;
	}

	/**
	 * attach and return a local array to the redis cache key
	 * the local array would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @return {Array}
	 */
	attachArray(key, mapKey) {
		const fullMap = this._getLocalAttachedMap(key);
		let array = fullMap.get(mapKey);
		if (!array) {
			array = [];
			fullMap.set(mapKey, array);
		}
		return array;
	}

	/**
	 * attach and return a local object to the redis cache key
	 * the local object would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @return {object}
	 */
	attachObject(key, mapKey) {
		const fullMap = this._getLocalAttachedMap(key);
		let obj = fullMap.get(mapKey);
		if (!obj) {
			obj = {};
			fullMap.set(mapKey, obj);
		}
		return obj;
	}

	/**
	 * attach and return a local lru map to the redis cache key
	 * the local lru map would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @param {object} options options for the lru map
	 * @return {LRU}
	 */
	attachLRU(key, mapKey, {maxItems = 100} = {}) {
		const fullMap = this._getLocalAttachedMap(key);
		let lru = fullMap.get(mapKey);
		if (!lru) {
			lru = new LRU({maxItems});
			fullMap.set(mapKey, lru);
		}
		return lru;
	}

	/**
	 * attach and return a local cache object to the redis cache key
	 * the local cache would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @param {object} options options for the cache object
	 * @return {Cache}
	 */
	attachCache(key, mapKey, options = {}) {
		const fullMap = this._getLocalAttachedMap(key);
		let cache = fullMap.get(mapKey);
		if (!cache) {
			cache = new Cache(options);
			fullMap.set(mapKey, cache);
		}
		return cache;
	}

	/**
	 * attach and return a custom object to the redis cache key
	 * custom object should be returned by the func
	 * the object would be deleted if redis cache key gets deleted
	 * @param {string} key
	 * @param {string} mapKey
	 * @param {function} func functions that returns the object
	 * @return {any}
	 */
	attachCustom(key, mapKey, func) {
		const fullMap = this._getLocalAttachedMap(key);
		let res = fullMap.get(mapKey);
		if (!res) {
			res = func();
			fullMap.set(mapKey, res);
		}
		return res;
	}

	/**
	 * delete an attached object to a key
	 * @param {string} key
	 * @param {string} mapKey
	 */
	deleteAttached(key, mapKey) {
		const value = this._localCache(key);
		if (!value || !value.a) return;
		value.a.delete(mapKey);
	}

	/**
	 * delete all attached objects to a key
	 * @param {string} key
	 */
	deleteAllAttached(key) {
		const value = this._localCache(key);
		if (!value || !value.a) return;
		value.a.clear();
		delete value.a;
		if (value.v === undefined) {
			this._localCache(key, DELETE, false);
		}
	}

	/**
	 * alias for getOrSet
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 * @return {any}
	 */
	async $(key, value, options = {}) {
		return this.getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the cache
	 * @param {string} key
	 */
	async del(key) {
		if (this.useLocalCache) {
			this._localCache(key, DELETE);
		}
		return this._del(key);
	}

	/**
	 * NOTE: this method is expensive, so don't use it unless absolutely necessary
	 * @return {number} the size of the cache (no. of keys)
	 */
	async size() {
		return this._size();
	}

	/**
	 * clears the cache (deletes all keys)
	 * NOTE: this method is expensive, so don't use it unless absolutely necessary
	 */
	async clear() {
		if (this.useLocalCache) {
			this._localCache('', CLEAR);
		}
		return this._clear();
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * @example
	 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
	 * const result = cachedFn('a', 'b');
	 * @param {string} key cache key with which to memoize the results
	 * @param {function} fn function to memoize
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 * @return {function}
	 */
	memoize(key, fn, options = {}) {
		return async (...args) => {
			let cacheKey;
			if (options.keyFn) {
				cacheKey = key + ':' + options.keyFn(...args);
			}
			else {
				cacheKey = key + ':' + JSON.stringify(args);
			}

			return this.getOrSet(cacheKey, () => fn(...args), options);
		};
	}

	/**
	 * delete everything from cache if the key includes a particular string
	 * to delete everything from cache, use `_all_` as string
	 * @param {string} str
	 * @return {number} number of keys deleted
	 */
	async delContains(str) {
		if (!str) {
			throw new Error('str must not be empty');
		}

		let keyGlob;
		if (str === '_all_') {
			keyGlob = `RC:${this.constructor.globalPrefix}:${this.prefix}:*`;
		}
		else if (this.prefix === '*') {
			keyGlob = `RC:${this.constructor.globalPrefix}:*${str}*`;
		}
		else {
			keyGlob = `RC:${this.constructor.globalPrefix}:${this.prefix}:*${str}*`;
		}

		this._localCache(str, DEL_CONTAINS);
		return this._delPattern(keyGlob);
	}
}

export default RedisCache;
