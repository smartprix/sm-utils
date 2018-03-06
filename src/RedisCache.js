import EventEmitter from 'events';
import Redis from 'ioredis';
import Cache from './Cache';

const FETCHING = Symbol('Fetching_Value');
const redisMap = {};
const localCache = new Cache();
const processId = process.pid;
let globalCache;

class RedisCache {
	static globalPrefix = 'all';

	constructor(prefix, redisConf = {}) {
		this.prefix = prefix;
		this.fetching = {};
		this.events = new EventEmitter();

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
		redisIns.on('message', this.handleSubscribeMessage);

		// eslint-disable-next-line no-use-before-define
		const channelName = `RC\v${this.globalPrefix}`;
		redisIns.subscribe(channelName, (err) => {
			console.error("[RedisCache] can't subscribe to channel", err);
		});
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

	async _get(key) {
		const prefixedKey = `${this.prefix}:${key}`;
		const value = await this.redis.get(prefixedKey);
		let parsedValue;
		try {
			parsedValue = JSON.parse(value);
		}
		catch (err) {
			parsedValue = value;
		}
		return parsedValue;
	}

	async _has(key) {
		return this.redis.exists(`${this.prefix}:${key}`);
	}

	_set(key, value, ttl = 0) {
		if (value === undefined) return true;
		const prefixedKey = `${this.prefix}:${key}`;

		if (ttl <= 0) {
			return this.redis.set(prefixedKey, JSON.stringify(value));
		}

		return this.redis.set(prefixedKey, JSON.stringify(value), 'PX', ttl);
	}

	_del(key) {
		return this.redis.del(`${this.prefix}:${key}`);
	}

	_clear() {
		return this.redis.eval(
			`for i, name in ipairs(redis.call('KEYS', '${this.prefix}:*')) do redis.call('DEL', name); end`,
			0,
		);
	}

	_size() {
		return this.redis.eval(`return #redis.pcall('keys', '${this.prefix}:*')`, 0);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async getStale(key, defaultValue = undefined) {
		const existing = await this._get(key);
		if (existing === null) return defaultValue;
		return existing;
	}

	/**
	 * gets a value from the cache
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async get(key, defaultValue = undefined) {
		if (this.fetching[key] === FETCHING) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			return new Promise((resolve) => {
				this.events.once(`get:${key}`, (val) => {
					if (val === null || val === undefined) resolve(defaultValue);
					else resolve(val);
				});
			});
		}

		this.fetching[key] = FETCHING;
		const value = await this.getStale(key, defaultValue);
		delete this.fetching[key];
		this.events.emit(`get:${key}`, value);
		return value;
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

		this.fetching[key] = FETCHING;

		try {
			if (value && value.then) {
				// value is a Promise
				// resolve it and then cache it
				const resolvedValue = await value;
				await this._set(key, resolvedValue, ttl);
				delete this.fetching[key];
				this.events.emit(`get:${key}`, resolvedValue);
				return true;
			}
			else if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return (await this.set(key, value(key), ttl));
			}

			// value is normal
			// just set it in the store
			await this._set(key, value, ttl);
			delete this.fetching[key];
			this.events.emit(`get:${key}`, value);
			return true;
		}
		catch (error) {
			await this._del(key);
			this.events.emit(`get:${key}`, undefined);
			delete this.fetching[key];
			return false;
		}
	}

	/**
	 * gets a value from the cache, or sets it if it doesn't exist
	 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {int|object} options either ttl in ms, or object of {ttl}
	 */
	async getOrSet(key, value, options = {}) {
		if (this.fetching[key] === FETCHING) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			return new Promise((resolve) => {
				this.events.once(`get:${key}`, resolve);
			});
		}

		this.fetching[key] = FETCHING;

		// key already exists, return it
		const existing = await this._get(key);
		if (existing !== null) {
			delete this.fetching[key];
			this.events.emit(`get:${key}`, existing);
			return existing;
		}

		// no value given, return undefined
		if (value === undefined) {
			this.events.emit(`get:${key}`, undefined);
			delete this.fetching[key];
			return undefined;
		}

		this.set(key, value, options);
		return new Promise((resolve) => {
			this.events.once(`get:${key}`, resolve);
		});
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
	 * Sets the max event listeners for the internal events object
	 * @param {Number} n A non-negative integer
	 */
	setMaxListeners(n) {
		this.events.setMaxListeners(n);
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

	static setMaxListeners(n) {
		return this.globalCache().setMaxListeners(n);
	}

	static memoize(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}
}

export default RedisCache;
