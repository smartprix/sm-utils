/* eslint-disable guard-for-in */
import timestring from 'timestring';
import LRU from './LRU';

let globalCache;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

function ttlMs(options) {
	let ttl = (typeof options === 'object') ? options.ttl : options;
	if (typeof ttl === 'string') {
		ttl = timestring(ttl, 'ms');
	}
	else {
		ttl = ttl || 0;
	}

	return ttl;
}

function getCacheKey(args, key, options) {
	if (typeof key === 'function') {
		return key(args);
	}
	if (options.keyFn) {
		return key + ':' + options.keyFn(args);
	}
	if (!args.length) {
		return key + ':null';
	}
	return key + ':' + JSON.stringify(args);
}

function tick() {
	return new Promise((resolve) => {
		setImmediate(resolve);
	});
}

/**
 * Local cache with dogpile prevention, lru, ttl and other goodies
 */
class Cache {
	constructor(options = {}) {
		if (options.maxItems) {
			// LRU
			this.data = new LRU({maxItems: options.maxItems});
		}
		else {
			this.data = new Map();
		}

		this.fetching = new Map();
	}

	_get(key, defaultValue = undefined) {
		const existing = this.data.get(key);
		if (existing === undefined) return defaultValue;
		if (existing.t) {
			const time = Date.now();
			if ((time - existing.c) > existing.t) {
				// value has expired
				this.data.delete(key);

				// call gc if required
				if (time - this.gcTime > FIFTEEN_MINUTES) {
					this.gc().then(
						() => {},
						(err) => {
							console.error('[Cache] Error while gc', err);
						},
					);
				}

				return defaultValue;
			}
		}
		return existing.v;
	}

	_set(key, value, ttl = 0) {
		const item = {
			v: value,
			c: Date.now(),
		};

		if (ttl <= 0) {
			this.data.set(key, item);
			return;
		}

		item.t = ttl;
		this.data.set(key, item);
	}

	_del(key) {
		// delete data
		this.data.delete(key);
	}

	_clear() {
		// clear data
		this.data.clear();
		this.fetching.clear();
	}

	/**
	 * gets a value from the cache
	 * this is sync version, so it'll not help with dogpiling issues
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	getSync(key, defaultValue = undefined) {
		return this._get(key, defaultValue);
	}

	/**
	 * gets a value from the cache
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async get(key, defaultValue = undefined) {
		const fetching = this.fetching.get(key);
		if (fetching) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			const value = await fetching;
			if (value === undefined) return defaultValue;
			return value;
		}

		return this._get(key, defaultValue);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 * @returns {any}
	 */
	getStaleSync(key, defaultValue = undefined) {
		return this._get(key, defaultValue);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 * @returns {any}
	 */
	async getStale(key, defaultValue = undefined) {
		return this._get(key, defaultValue);
	}

	/**
	 * checks if a key exists in the cache
	 * @param {string} key
	 * @returns {boolean}
	 */
	hasSync(key) {
		return this.data.has(key);
	}

	/**
	 * checks if a key exists in the cache
	 * @param {string} key
	 * @returns {boolean}
	 */
	async has(key) {
		return this.data.has(key);
	}

	/**
	 * @typedef {object} setOptsObject
	 * @property {number|string} ttl in ms / timestring ('1d 3h') default: 0
	 */

	/**
	 * @typedef {setOptsObject | string | number} setOpts
	 */

	/**
	 * sets a value in the cache
	 * this is sync version, so value should not be a promise or async function
	 * @param {string} key
	 * @param {any} value
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {Promise<boolean>}
	 */
	setSync(key, value, options = {}) {
		const ttl = ttlMs(options);

		try {
			if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return this.setSync(key, value(key), ttl);
			}

			// value is normal
			// just set it in the store
			this._set(key, value, ttl);
			return true;
		}
		catch (error) {
			this._del(key);
			return false;
		}
	}

	/**
	 * sets a value in the cache
	 * avoids dogpiling if the value is a promise or a function returning a promise
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {boolean}
	 */
	async set(key, value, options = {}) {
		const ttl = ttlMs(options);

		try {
			if (value && value.then) {
				// value is a Promise
				// resolve it and then cache it
				this.fetching.set(key, value);
				const resolvedValue = await value;
				this._set(key, resolvedValue, ttl);
				this.fetching.delete(key);
				return true;
			}
			if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return this.set(key, value(key), ttl);
			}
			if (value === undefined) {
				// don't set undefined value
				return false;
			}

			// value is normal
			// just set it in the store
			this._set(key, value, ttl);
			return true;
		}
		catch (error) {
			this._del(key);
			this.fetching.delete(key);
			return false;
		}
	}

	/**
	 * gets a value from the cache, or sets it if it doesn't exist
	 * this is sync version, so value should not be a promise or async function
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	getOrSetSync(key, value, options = {}) {
		// key already exists, return it
		const existing = this._get(key);
		if (existing !== undefined) return existing;

		// no value given, return undefined
		if (value === undefined) return undefined;

		this.setSync(key, value, options);
		return this.data.get(key).v;
	}

	/**
	 * gets a value from the cache, or sets it if it doesn't exist
	 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	async getOrSet(key, value, options = {}) {
		const fetching = this.fetching.get(key);
		if (fetching) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			return fetching;
		}

		// key already exists, return it
		const existing = this._get(key);
		if (existing !== undefined) return existing;

		// no value given, return undefined
		if (value === undefined) return undefined;

		await this.set(key, value, options);
		return this.data.get(key).v;
	}

	/**
	 * alias for getOrSet
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	async $(key, value, options = {}) {
		return this.getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the cache
	 * @param {string} key
	 * @return {void}
	 */
	delSync(key) {
		return this._del(key);
	}

	/**
	 * deletes a value from the cache
	 * @param {string} key
	 * @return {void}
	 */
	async del(key) {
		return this._del(key);
	}

	/**
	 * returns the size of the cache (no. of keys)
	 * NOTE: expired items are returned as part of this count
	 * @return {number}
	 */
	async size() {
		return this.data.size;
	}

	/**
	 * returns the size of the cache (no. of keys)
	 * NOTE: expired items are returned as part of this count
	 * @return {number}
	 */
	sizeSync() {
		return this.data.size;
	}

	/**
	 * clears the cache (deletes all keys)
	 * @return {void}
	 */
	async clear() {
		return this._clear();
	}

	/**
	 * clears the cache (deletes all keys)
	 * @return {void}
	 */
	clearSync() {
		return this._clear();
	}

	/**
	 * delete expired items
	 * NOTE: this method needs to loop over all the items (expensive)
	 */
	async gc() {
		const time = Date.now();
		this.gcTime = time;

		if (this.data.size < 50000) {
			this.gcSync();
			return;
		}

		let i = 0;
		for (const [key, value] of this.data) {
			if (value.t && (time - value.c > value.t)) {
				// value is expired
				this.data.delete(key);
			}

			i++;
			if ((i & 32767) === 0) {
				// allow other tasks to execute after every 50000 elements
				// eslint-disable-next-line no-await-in-loop
				await tick();
			}
		}
	}

	/**
	 * delete expired items synchronously
	 * NOTE: this method needs to loop over all the items (expensive)
	 */
	gcSync() {
		const time = Date.now();
		this.gcTime = time;

		for (const [key, value] of this.data) {
			if (value.t && (time - value.c > value.t)) {
				// value is expired
				this.data.delete(key);
			}
		}
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * ```js
	 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
	 * const result = cachedFn('a', 'b');
	 * ```
	 * This is sync version, so fn should not be async
	 * @param {string} key cache key with which to memoize the results
	 * @param {function} fn function to memoize
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {function} memoized function
	 */
	memoizeSync(key, fn, options = {}) {
		return (...args) => (
			this.getOrSetSync(
				getCacheKey(args, key, options),
				() => fn(...args),
				options,
			)
		);
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * ```js
	 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
	 * const result = cachedFn('a', 'b');
	 * ```
	 * @param {string} key cache key with which to memoize the results
	 * @param {function} fn function to memoize
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {function} memoized function
	 */
	memoize(key, fn, options = {}) {
		return async (...args) => (
			this.getOrSet(
				getCacheKey(args, key, options),
				() => fn(...args),
				options,
			)
		);
	}

	/**
	 * returns a global cache instance
	 * @return {Cache}
	 */
	static globalCache() {
		if (!globalCache) globalCache = new this();
		return globalCache;
	}

	/**
	 * get value from global cache
	 * this is sync version, so it'll not help with dogpiling issues
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static getSync(key, defaultValue) {
		return this.globalCache().getSync(key, defaultValue);
	}

	/**
	 * get value from global cache
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static async get(key, defaultValue) {
		return this.globalCache().get(key, defaultValue);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static getStaleSync(key, defaultValue) {
		return this.globalCache().getStaleSync(key, defaultValue);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static async getStale(key, defaultValue) {
		return this.globalCache().getStale(key, defaultValue);
	}

	/**
	 * checks if value exists in global cache
	 * @param {string} key
	 * @return {boolean}
	 */
	static hasSync(key) {
		return this.globalCache().hasSync(key);
	}

	/**
	 * checks if value exists in global cache
	 * @param {string} key
	 * @return {boolean}
	 */
	static async has(key) {
		return this.globalCache().has(key);
	}

	/**
	 * sets a value in the global cache
	 * this is sync version, so value should not be a promise or async function
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {boolean}
	 */
	static setSync(key, value, options = {}) {
		return this.globalCache().set(key, value, options);
	}

	/**
	 * sets a value in the global cache
	 * @param {string} key
	 * @param {any} value
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {Promise<boolean>}
	 */
	static async set(key, value, options = {}) {
		return this.globalCache().set(key, value, options);
	}

	/**
	 * get or set a value in the global cache
	 * this is sync version, so value should not be a promise or async function
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	static getOrSetSync(key, value, options = {}) {
		return this.globalCache().getOrSetSync(key, value, options);
	}

	/**
	 * get or set a value in the global cache
	 * @param {string} key
	 * @param {any} value
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	static async getOrSet(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * alias for getOrSet
	 * @param {string} key
	 * @param {any} value
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	static async $(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the global cache
	 * @param {string} key
	 * @return {void}
	 */
	static delSync(key) {
		return this.globalCache().delSync(key);
	}

	/**
	 * deletes a value from the global cache
	 * @param {string} key
	 * @return {void}
	 */
	static async del(key) {
		return this.globalCache().del(key);
	}

	/**
	 * @return {number} the size of the global cache
	 */
	static async size() {
		return this.globalCache().size();
	}

	/**
	 * @return {number} the size of the global cache
	 */
	static sizeSync() {
		return this.globalCache().sizeSync();
	}

	/**
	 * clear the global cache
	 * @return {void}
	 */
	static async clear() {
		return this.globalCache().clear();
	}

	/**
	 * clear the global cache
	 * @return {void}
	 */
	static clearSync() {
		return this.globalCache().clearSync();
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * this is sync version, so fn should not be async
	 * @param {string} key
	 * @param {function} fn
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {function} memoized function
	 */
	static memoizeSync(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}

	/**
	 * memoizes a function (caches the return value of the function)
	 * @param {string} key
	 * @param {function} fn
	 * @param {setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {function} memoized function
	 */
	static memoize(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}
}

export default Cache;
