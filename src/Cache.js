/* eslint-disable guard-for-in */
import timestring from 'timestring';

let globalCache;

/**
 * Local cache with dogpile prevention
 */
class Cache {
	constructor() {
		this.data = new Map();
		this.ttl = new Map();
		this.fetching = new Map();
	}

	_set(key, value, ttl = 0) {
		if (ttl <= 0) {
			this.data.set(key, value);
			return;
		}

		// set value
		this.data.set(key, value);

		// set ttl
		clearTimeout(this.ttl.get(key));
		this.ttl.set(key, setTimeout(() => this.del(key), ttl));
	}

	_del(key) {
		// delete ttl
		if (this.ttl.has(key)) {
			clearTimeout(this.ttl.get(key));
			this.ttl.delete(key);
		}

		// delete data
		this.data.delete(key);
	}

	_clear() {
		// clear ttl
		this.ttl.forEach(value => clearTimeout(value));
		this.ttl.clear();

		// clear data
		this.data.clear();
		this.fetching.clear();
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

		const existing = this.data.get(key);
		if (existing === undefined) return defaultValue;
		return existing;
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 */
	async getStale(key, defaultValue = undefined) {
		const existing = this.data.get(key);
		if (existing === undefined) return defaultValue;
		return existing;
	}

	/**
	 * checks if a key exists in the cache
	 * @param {string} key
	 */
	async has(key) {
		return this.data.has(key);
	}

	/**
	 * @typedef {object} setOpts
	 * @property {number|string} ttl in ms / timestring ('1d 3h') default: 0
	 */

	/**
	 * sets a value in the cache
	 * avoids dogpiling if the value is a promise or a function returning a promise
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {boolean}
	 */
	async set(key, value, options = {}) {
		let ttl = (typeof options === 'object') ? options.ttl : options;
		if (typeof ttl === 'string') {
			ttl = timestring(ttl, 'ms');
		}
		else {
			ttl = ttl || 0;
		}

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
			else if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return this.set(key, value(key), ttl);
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
	 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
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
		const existing = this.data.get(key);
		if (existing !== undefined) return existing;

		// no value given, return undefined
		if (value === undefined) return undefined;

		await this.set(key, value, options);
		return this.data.get(key);
	}

	/**
	 * alias for getOrSet
	 * @param {string} key key to get
	 * @param {any} value value to set if the key does not exist
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
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
	async del(key) {
		return this._del(key);
	}

	/**
	 * returns the size of the cache (no. of keys)
	 * @return {number}
	 */
	async size() {
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
	 * returns a global cache instance
	 * @return {Cache}
	 */
	static globalCache() {
		if (!globalCache) globalCache = new this();
		return globalCache;
	}

	/**
	 * get value from global cache
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static get(key, defaultValue) {
		return this.globalCache().get(key, defaultValue);
	}

	/**
	 * gets a value from the cache immediately without waiting
	 * @param {string} key
	 * @param {any} defaultValue
	 * @return {any}
	 */
	static getStale(key, defaultValue) {
		return this.globalCache().getStale(key, defaultValue);
	}

	/**
	 * checks if value exists in global cache
	 * @param {string} key
	 * @return {boolean}
	 */
	static has(key) {
		return this.globalCache().has(key);
	}

	/**
	 * sets a value in the global cache
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {boolean}
	 */
	static set(key, value, options = {}) {
		return this.globalCache().set(key, value, options);
	}

	/**
	 * get or set a value in the global cache
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	static getOrSet(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * alias for getOrSet
	 * @param {string} key
	 * @param {any} value
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {any}
	 */
	static $(key, value, options = {}) {
		return this.globalCache().getOrSet(key, value, options);
	}

	/**
	 * deletes a value from the global cache
	 * @param {string} key
	 * @return {void}
	 */
	static del(key) {
		return this.globalCache().del(key);
	}

	/**
	 * @return {number} the size of the global cache
	 */
	static size() {
		return this.globalCache().size();
	}

	/**
	 * clear the global cache
	 * @return {void}
	 */
	static clear() {
		return this.globalCache().clear();
	}

	/**
	 *
	 * @param {string} key
	 * @param {function} fn
	 * @param {number|string|setOpts} [options={}] ttl in ms/timestring('1d 3h') or opts (default: 0)
	 * @return {function} memoized function
	 */
	static memoize(key, fn, options = {}) {
		return this.globalCache().memoize(key, fn, options);
	}
}

export default Cache;
