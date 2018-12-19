import Redis from 'ioredis';
import timestring from 'timestring';
import {Observer} from 'micro-observer';
import _ from 'lodash';

const DELETE = Symbol('DELETE');
const DEL_CONTAINS = Symbol('DEL_CONTAINS');
const CLEAR = Symbol('CLEAR');
const redisMap = {};
const localCache = new Map();
const localCacheTTL = new Map();
const processId = process.pid;
const getting = new Map();
const setting = new Map();
const getOrSetting = new Map();
const getOrSettingStale = new Map();
let globalCache;

async function _withDefault(promise, defaultValue) {
	const value = await promise;
	if (value === undefined) return defaultValue;
	return value;
}

function parseTTL(ttl) {
	if (typeof ttl === 'string') return timestring(ttl, 'ms');
	return ttl;
}

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
	static defaultRedisConf = {
		host: '127.0.0.1',
		port: 6379,
		password: undefined,
	};

	/**
	 * @ignore
	 * @typedef {object} redisConf
	 * @property {string} host
	 * @property {number} port
	 * @property {string} [auth]
	 * @property {string} [password]
	 */

	/**
	 *
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

		/** @type {Redis} */
		this.redis = this.constructor.getRedis(redis);

		if ('useLocalCache' in redisConf) {
			this.useLocalCache = redisConf.useLocalCache;
		}
		else if ('useLocalCache' in options) {
			this.useLocalCache = options.useLocalCache;
		}
		else {
			this.useLocalCache = this.constructor.useLocalCache;
		}
	}

	/**
	 * @param {redisConf} redis
	 */
	static getRedis(redis) {
		const address = `${redis.host}:${redis.port}`;

		// cache redis connections in a map to prevent a new connection on each instance
		if (!redisMap[address]) {
			redisMap[address] = new Redis(redis);

			redisMap[address].on('error', (err) => {
				this.logger.error(`[RedisCache] error in redis connection on ${address}`, err);
			});

			// we need a different connection for subscription, because once subscribed
			// no other commands can be issued
			this.subscribe(redis);
		}

		return redisMap[address];
	}

	/**
	 * @param {redisConf} redis
	 */
	static subscribe(redis) {
		const redisIns = new Redis(redis);

		redisIns.on('error', (err) => {
			this.logger.error(`[RedisCache] error in redis connection on ${redis.host}:${redis.port}`, err);
		});

		const channelName = `RC:${this.globalPrefix}`;

		redisIns.subscribe(channelName, (err) => {
			if (err) {
				this.logger.error(`[RedisCache] can't subscribe to channel ${channelName}`, err);
			}
		});

		redisIns.on('message', this.handleSubscribeMessage.bind(this));
	}

	static handleSubscribeMessage(channel, message) {
		// the channel is RC:${globalPrefix} => RC:a
		// the message is ${pid}\v${prefix}\v${command}\v${args.join('\v')}
		const [pid, prefix, command, key, ...args] = message.split('\v');

		// RedisCache.logger.log(`[RedisCache] received subscribe command ${command} ${prefix}:${key}`);

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
			const ttl = Number(args[0]);
			const value = args[1];

			this._localCache(prefix, key, value, ttl);
		}
		else {
			this.logger.error(`[RedisCache] unknown subscribe command ${command}`);
		}
	}

	// key for localCahce
	static _localKey(prefix, key) {
		return `${prefix}:${key}`;
	}

	// key for localCahce
	_localKey(key) {
		return `${this.prefix}:${key}`;
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

	async _getWithTTL(key) {
		this.constructor.redisGetCount++;
		const prefixedKey = this._key(key);
		const results = await this.redis.pipeline([
			['get', prefixedKey],
			['pttl', prefixedKey],
		]).exec();

		const value = results[0][1];
		const ttl = results[1][1];

		if (value === null) return [undefined, ttl];
		try {
			return [JSON.parse(value), ttl];
		}
		catch (err) {
			return [value, ttl];
		}
	}

	async _getAuto(key) {
		if (this.useLocalCache) {
			return this._getWithTTL(key);
		}

		return [await this._get(key), 0];
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

		this._localCache(key, data, ttl, false);
	}

	_setBoth(key, value, ttl = 0) {
		if (value === undefined) return true;

		const data = {
			c: Date.now(),
			v: value,
		};

		if (this.useLocalCache) {
			this._localCache(key, data, ttl);
		}

		return this._set(key, data, ttl);
	}

	_del(key) {
		return this.redis.unlink(this._key(key));
	}

	_clear() {
		const keyGlob = this._key('*');
		return this.redis.eval(
			`for i, name in ipairs(redis.call('KEYS', '${keyGlob}')) do redis.call('UNLINK', name); end`,
			0,
		);
	}

	_size() {
		const keyGlob = this._key('*');
		return this.redis.eval(`return #redis.pcall('keys', '${keyGlob}')`, 0);
	}

	// eslint-disable-next-line max-statements
	static _localCache(prefix, key, value, ttl = 0, redis = null) {
		// the channel is RC:${globalPrefix} => RC:a
		// the message is ${pid}\v${prefix}\v${command}\v${args.join('\v')}

		const prefixedKey = this._localKey(prefix, key);
		if (value === undefined) {
			const cached = localCache.get(prefixedKey);
			if (cached === undefined) return undefined;
			return cached;
		}

		if (value === CLEAR) {
			if (redis) {
				const channelName = `RC:${this.globalPrefix}`;
				const message = `${processId}\v${prefix}\vclear\vnull`;
				redis.publish(channelName, message);
			}

			localCache.forEach((_value, _key) => {
				if (_key.startsWith(`${prefix}:`)) {
					// delete ttl
					if (localCacheTTL.has(_key)) {
						clearTimeout(localCacheTTL.get(_key));
						localCacheTTL.delete(_key);
					}

					// delete data
					localCache.delete(_key);
				}
			});

			return undefined;
		}

		if (value === DEL_CONTAINS) {
			if (redis) {
				const channelName = `RC:${this.globalPrefix}`;
				const message = `${processId}\v${prefix}\vdel_contains\v${key}`;
				redis.publish(channelName, message);
			}

			const delKey = (_key) => {
				// delete ttl
				if (localCacheTTL.has(_key)) {
					clearTimeout(localCacheTTL.get(_key));
					localCacheTTL.delete(_key);
				}

				// delete data
				localCache.delete(_key);
			};

			if (key.includes('*')) {
				let keyRegex;
				if (prefix === '*') {
					keyRegex = new RegExp(key.replace('*', '.*'));
				}
				else {
					keyRegex = new RegExp(`^${this.prefix}:.*${key.replace('*', '.*')}`);
				}

				localCache.forEach((_value, _key) => {
					if (keyRegex.test(_key)) {
						delKey(_key);
					}
				});
			}
			else {
				// delete all keys
				if (key === '_all_') key = '';

				const anyPrefix = (prefix === '*');
				localCache.forEach((_value, _key) => {
					if (
						(anyPrefix || _key.startsWith(`${prefix}:`)) &&
						_key.includes(key)
					) {
						delKey(_key);
					}
				});
			}

			return undefined;
		}

		if (value === DELETE) {
			if (redis) {
				const channelName = `RC:${this.globalPrefix}`;
				const message = `${processId}\v${prefix}\vdelete\v${key}`;
				redis.publish(channelName, message);
			}

			// delete ttl
			if (localCacheTTL.has(prefixedKey)) {
				clearTimeout(localCacheTTL.get(prefixedKey));
				localCacheTTL.delete(prefixedKey);
			}

			// delete data
			localCache.delete(prefixedKey);
			return undefined;
		}

		// set value
		if (redis) {
			const channelName = `RC:${this.globalPrefix}`;
			const message = `${processId}\v${prefix}\vsetdel\v${key}`;
			redis.publish(channelName, message);
		}

		localCache.set(prefixedKey, value);
		if (ttl > 0) {
			// set ttl
			clearTimeout(localCacheTTL.get(prefixedKey));
			localCacheTTL.set(prefixedKey, setTimeout(() => {
				clearTimeout(localCacheTTL.get(prefixedKey));
				localCacheTTL.delete(prefixedKey);
				localCache.delete(prefixedKey);
			}, ttl));
		}

		return value;
	}

	_localCache(key, value, ttl = 0, publish = true) {
		return this.constructor._localCache(this.prefix, key, value, ttl, publish && this.redis);
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
			if (localValue !== undefined) {
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

		const promise = this._getAuto(key).then(async ([value, ttl]) => {
			if (value === undefined) return [value, ttl];
			if (ctx.staleTTL) {
				if (value.c < Date.now() - ctx.staleTTL) {
					ctx.isStale = true;
				}
			}
			if (options.parse) {
				return [await options.parse(value.v), ttl];
			}
			return [value.v, ttl];
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
			if (localValue !== undefined) {
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
		let generateInBg = true;
		if (existingValue === undefined) {
			if (options.requireResult === false || options.freshResult) {
				generateInBg = false;
			}
		}
		else if (ctx.isStale) {
			if (options.freshResult) {
				generateInBg = false;
			}
		}

		if (!generateInBg) {
			// regenerate value in the foreground
			const setCtx = {};
			await this.set(key, value, options, setCtx);
			return setCtx.result;
		}

		// regenerate value in the background
		this._setBackground(key, value, options);
		return existingValue;
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
		return this.redis.eval(
			`local j=0; for i, name in ipairs(redis.call('KEYS', '${keyGlob}')) do redis.call('UNLINK', name); j=i end return j`,
			0,
		);
	}

	/**
	 * Return a global instance of Redis cache
	 * @param {object} [redis] redis redisConf
	 * @return {RedisCache}
	 */
	static globalCache(redis) {
		if (!globalCache) globalCache = new this('global', redis);
		return globalCache;
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	static getStale(key, defaultValue) {
		return this.globalCache().getStale(key, defaultValue);
	}

	/**
	 * gets a value from the global cache
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	static get(key, defaultValue) {
		return this.globalCache().get(key, defaultValue);
	}

	/**
	 * checks if a key exists in the global cache
	 * @param {string} key
	 */
	static has(key) {
		return this.globalCache().has(key);
	}

	/**
	 * sets a value in the global cache
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 * @return {boolean}
	 */
	static set(key, value, options = {}) {
		return this.globalCache().set(key, value, options);
	}

	/**
	 * gets a value from the global cache, or sets it if it doesn't exist
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 */
	static getOrSet(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * alias for getOrSet
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 */
	static $(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the global cache
	 * @param {string} key
	 */
	static del(key) {
		return this.globalCache().del(key);
	}

	/**
	 * @return {number} size of the global cache (no. of keys)
	 */
	static size() {
		return this.globalCache().size();
	}

	/**
	 * clears the global cache (deletes all keys)
	 */
	static clear() {
		return this.globalCache().clear();
	}

	/**
	 *
	 * memoizes a function (caches the return value of the function)
	 * @param {string} key
	 * @param {function} fn
	 * @param {number|string|setRedisOpts} [options={}] ttl in ms/timestring('1d 3h') (default: 0)
	 * or opts with parse and ttl
	 * @return {function}
	 */
	static memoize(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}
}

export default RedisCache;
