import Redis from 'ioredis';
import Cache from './Cache';

const redisMap = {};
const localCache = new Cache();
const processId = process.pid;
const getting = {};
const setting = {};
let globalCache;

async function _withDefault(promise, defaultValue) {
	const value = await promise;
	if (value === undefined) return defaultValue;
	return value;
}

class RedisCache {
	static globalPrefix = 'a';

	constructor(prefix, redisConf = {}) {
		this.prefix = prefix;

		if (redisConf instanceof Redis) {
			this.redis = redisConf;
			return;
		}

		const redis = {
			host: redisConf.host || '127.0.0.1',
			port: redisConf.port || 6379,
			password: redisConf.password || redisConf.auth || undefined,
		};

		this.redis = this.constructor.getRedis(redis);
	}

	static getRedis(redis) {
		const address = `${redis.host}:${redis.port}`;

		// cache redis connections in a map to prevent a new connection on each instance
		if (!redisMap[address]) {
			redisMap[address] = new Redis(redis);

			// we need a different connection for subscription, because once subscribed
			// no other commands can be issued
			this.subscribe(redis);
		}

		return redisMap[address];
	}

	static subscribe(redis) {
		const redisIns = new Redis(redis);
		const channelName = `RC:${this.globalPrefix}`;

		redisIns.subscribe(channelName, (err) => {
			if (err) {
				console.error(`[RedisCache] can't subscribe to channel ${channelName}`, err);
			}
		});

		redisIns.on('message', this.handleSubscribeMessage);
	}

	static handleSubscribeMessage(channel, message) {
		// the channel is RC\v${globalPrefix} => Rs\vall
		// the message is ${pid}\v${prefix}\v${command}\v${args.join('\v')}
		const [pid, prefix, command, key, ...args] = message.split('\v');

		if (Number(pid) === processId) {
			// since the message came from the same process, it's already been handled
			// we don't need to do anything
			return;
		}

		if (command === 'delete') {
			localCache.del(`${prefix}:${key}`)
				.then(() => {})
				.catch(e => console.error(e));
		}
		else if (command === 'set') {
			const ttl = Number(args[0]);
			const value = args[1];

			localCache.set(`${prefix}:${key}`, value, {ttl})
				.then(() => {})
				.catch(e => console.error(e));
		}
		else {
			console.error(`[RedisCache] unknown subscribe command ${command}`);
		}
	}

	// get prefixed key for redis
	_key(key) {
		return `RC:${this.constructor.globalPrefix}:${this.prefix}:${key}`;
	}

	async _get(key) {
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

	_del(key) {
		return this.redis.del(this._key(key));
	}

	_clear() {
		const keyGlob = this._key('*');
		return this.redis.eval(
			`for i, name in ipairs(redis.call('KEYS', '${keyGlob}')) do redis.call('DEL', name); end`,
			0,
		);
	}

	_size() {
		const keyGlob = this._key('*');
		return this.redis.eval(`return #redis.pcall('keys', '${keyGlob}')`, 0);
	}

	_getting(key, value) {
		const prefixedKey = this._key(key);
		if (value === undefined) {
			return getting[prefixedKey];
		}
		if (value === false) {
			delete getting[prefixedKey];
			return undefined;
		}

		getting[prefixedKey] = value;
		return value;
	}

	_setting(key, value) {
		const prefixedKey = this._key(key);
		if (value === undefined) {
			return setting[prefixedKey];
		}
		if (value === false) {
			delete setting[prefixedKey];
			return undefined;
		}

		setting[prefixedKey] = value;
		return value;
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async getStale(key, defaultValue = undefined) {
		const gettingPromise = this._getting(key);
		if (gettingPromise) {
			return _withDefault(gettingPromise, defaultValue);
		}

		const promise = this._get(key);
		this._getting(key, promise);
		const value = await _withDefault(promise, defaultValue);
		this._getting(key, false);
		return value;
	}

	/**
	 * gets a value from the cache
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async get(key, defaultValue = undefined) {
		const settingPromise = this._setting(key);
		if (settingPromise) {
			return _withDefault(settingPromise, defaultValue);
		}

		return this.getStale(key, defaultValue);
	}

	/**
	 * checks if a key exists in the cache
	 * @param {string} key
	 */
	async has(key) {
		return this._has(key);
	}

	/**
	 * sets a value in the cache
	 * avoids dogpiling if the value is a promise or a function returning a promise
	 * @param {string} key
	 * @param {any} value
	 * @param {int|object} options either ttl in ms, or object of {ttl}
	 */
	async set(key, value, options = {}) {
		let ttl;
		if (typeof options === 'number') {
			ttl = options;
		}
		else {
			ttl = options.ttl || 0;
		}

		try {
			if (value && value.then) {
				// value is a Promise
				// resolve it and then cache it
				this._setting(key, value);
				const resolvedValue = await value;
				await this._set(key, resolvedValue, ttl);
				this._setting(key, false);
				return true;
			}
			else if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return this.set(key, value(key), ttl);
			}

			// value is normal
			// just set it in the store
			this._setting(key, Promise.resolve(value));
			await this._set(key, value, ttl);
			this._setting(key, false);
			return true;
		}
		catch (error) {
			await this._del(key);
			this._setting(key, false);
			return false;
		}
	}

	async _getOrSet(key, value, options = {}) {
		// key already exists, return it
		const existingValue = await this.getStale(key);
		if (existingValue !== undefined) {
			return existingValue;
		}

		// no value given, return undefined
		if (value === undefined) {
			this._setting(key, Promise.resolve(undefined));
			return undefined;
		}

		this.set(key, value, options);
		return this._setting(key);
	}

	/**
	 * gets a value from the cache, or sets it if it doesn't exist
	 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {int|object} options either ttl in ms, or object of {ttl}
	 */
	async getOrSet(key, value, options = {}) {
		const settingPromise = this._setting(key);
		if (settingPromise) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			return settingPromise;
		}

		return this._setting(key, this._getOrSet(key, value, options));
	}

	/**
	 * alias for getOrSet
	 */
	async $(key, value, options = {}) {
		return this.getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the cache
	 * @param {string} key
	 */
	async del(key) {
		return this._del(key);
	}

	/**
	 * returns the size of the cache (no. of keys)
	 * NOTE: this method is expansive, so don't use it unless absolutely necessary
	 */
	async size() {
		return this._size();
	}

	/**
	 * clears the cache (deletes all keys)
	 * NOTE: this method is expansive, so don't use it unless absolutely necessary
	 */
	async clear() {
		return this._clear();
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * ```js
	 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
	 * const result = cachedFn('a', 'b');
	 * ```
	 * @param {string} key cache key with which to memoize the results
	 * @param {function} fn function to memoize
	 * @param {int|object} options either ttl in ms, or object of {ttl}
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

	static globalCache(redis) {
		if (!globalCache) globalCache = new this('global', redis);
		return globalCache;
	}

	static getStale(key, defaultValue) {
		return this.globalCache().getStale(key, defaultValue);
	}

	static get(key, defaultValue) {
		return this.globalCache().get(key, defaultValue);
	}

	static has(key) {
		return this.globalCache().has(key);
	}

	static set(key, value, options = {}) {
		return this.globalCache().set(key, value, options);
	}

	static getOrSet(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	static $(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	static del(key) {
		return this.globalCache().del(key);
	}

	static size() {
		return this.globalCache().size();
	}

	static clear() {
		return this.globalCache().clear();
	}

	static memoize(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}
}

export default RedisCache;
