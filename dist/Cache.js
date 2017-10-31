'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let globalCache; /* eslint-disable guard-for-in */


class TTL {
	constructor() {
		this.data = {};
	}

	set(key, ttl, callback) {
		clearTimeout(this.data[key]);
		this.data[key] = setTimeout(callback, ttl);
	}

	del(key) {
		clearTimeout(this.data[key]);
		delete this.data[key];
	}

	clear() {
		for (const ttl in this.data) {
			clearTimeout(this.data[ttl]);
		}
		this.data = {};
	}
}

class Store {
	constructor() {
		this.data = {};
	}

	async get(key, defaultValue = undefined) {
		if (key in this.data) return this.data[key];
		return defaultValue;
	}

	async set(key, value, ttl = 0) {
		if (ttl <= 0) {
			this.data[key] = value;
			return;
		}

		this.set(key, value);

		if (!this.ttl) this.ttl = new TTL();
		this.ttl.set(key, ttl, () => this.del(key));
	}

	async del(key) {
		if (this.ttl) this.ttl.del(key);
		delete this.cache[key];
	}

	async has(key) {
		return key in this.data;
	}

	async clear() {
		if (this.ttl) this.ttl.clear();
		this.data = {};
	}

	async size() {
		return Object.keys(this.cache).length;
	}
}

class Cache {
	constructor() {
		this.fetching = {};
		this.store = new Store();
	}

	get(key, defaultValue = undefined) {
		if (this.fetching[key]) {
			// Some other process is still fetching the value
			// Don't dogpile shit, wait for the other process
			// to finish it
			if (!this.events) Promise.reject(new Error('Cache EventEmitter Missing'));

			return new Promise((resolve, reject) => {
				this.events.once(`get:${key}`, ({ error, value }) => {
					if (error) reject(error);else resolve(value);
				});
			});
		}

		return this.store.get(key, defaultValue);
	}

	async set(key, value, ttl = 0) {
		if (value && value.then) {
			// value is a Promise
			// resolve it and then cache it
			if (!this.events) this.events = new _events2.default();
			this.fetching[key] = true;
			try {
				const resolvedValue = await value;
				await this.store.set(key, resolvedValue, ttl);

				delete this.fetching[key];
				this.events.emit(`get:${key}`, { value: resolvedValue });

				return true;
			} catch (error) {
				// Ignore Error
				delete this.fetching[key];
				this.events.emit(`get:${key}`, { error });
				return false;
			}
		}

		await this.store.set(key, value, ttl);
		return true;
	}

	async del(key) {
		return this.store.del(key);
	}

	async size() {
		return this.store.size();
	}

	async clear() {
		return this.store.clear();
	}

	static globalCache() {
		if (!globalCache) globalCache = new this();
		return globalCache;
	}

	static get(key) {
		return this.globalCache().get(key);
	}

	static set(key, value, ttl) {
		return this.globalCache().set(key, value, ttl);
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

exports.default = Cache;