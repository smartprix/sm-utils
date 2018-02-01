'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const FETCHING = Symbol('Fetching_Value');
let globalCache;

class RedisCache {
	constructor(prefix, redis) {
		this.prefix = prefix;
		this.redis = redis;
		this.fetching = {};
		this.events = new _events2.default();
	}

	async _get(key) {
		const prefixedKey = `${this.prefix}:${key}`;
		const value = await this.redis.get(prefixedKey);
		let parsedValue;
		try {
			parsedValue = JSON.parse(value);
		} catch (err) {
			parsedValue = value;
		}
		return parsedValue;
	}

	async _has(key) {
		return this.redis.exists(`${this.prefix}:${key}`);
	}

	_set(key, value, ttl = 0) {
		const prefixedKey = `${this.prefix}:${key}`;

		if (ttl <= 0) {
			return this.redis.set(prefixedKey, value);
		}

		if (value === undefined) return true;
		return this.redis.set(prefixedKey, JSON.stringify(value), 'PX', ttl);
	}

	_del(key) {
		return this.redis.del(`${this.prefix}:${key}`);
	}

	_clear() {
		return this.redis.eval(`for i, name in ipairs(redis.call('KEYS', '${this.prefix}:*')) do redis.call('DEL', name); end`, 0);
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
			return new Promise(resolve => {
				this.events.once(`get:${key}`, resolve);
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
		} else {
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
			} else if (typeof value === 'function') {
				// value is a function
				// call it and set the result
				return await this.set(key, value(key), ttl);
			}

			// value is normal
			// just set it in the store
			await this._set(key, value, ttl);
			delete this.fetching[key];
			this.events.emit(`get:${key}`, value);
			return true;
		} catch (error) {
			await this._del(key);
			this.events.emit(`get:${key}`, undefined);
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
			return new Promise(resolve => {
				this.events.once(`get:${key}`, resolve);
			});
		}

		this.fetching[key] = FETCHING;

		// key already exists, return it
		const existing = await this._get(key);
		if (existing !== null) {
			delete this.fetching[key];
			return existing;
		}

		this.set(key, value, options);
		return new Promise(resolve => {
			this.events.once(`get:${key}`, resolve);
		});
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

	static globalCache(redis) {
		if (!globalCache) globalCache = new this(redis);
		return globalCache;
	}

	static get(key) {
		return this.globalCache().get(key);
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

	static del(key) {
		return this.globalCache().del(key);
	}

	static size() {
		return this.globalCache().size();
	}

	static clear() {
		return this.globalCache().clear();
	}
}

exports.default = RedisCache;