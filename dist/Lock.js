'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _ioredis = require('ioredis');

var _ioredis2 = _interopRequireDefault(_ioredis);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Lock extends _events2.default {
	constructor(redis) {
		super();

		this.prefix = 'LOCK';
		this.fetching = {};

		if (redis) this.redis = redis;else this.redis = new _ioredis2.default();

		this.acquireQueue = {};
		this.on('released', this._handleRelease);
	}

	_key(key) {
		return `${this.prefix}:${key}`;
	}

	async _get(key) {
		return this.redis.get(this._key(key));
	}

	async _set(key) {
		return this.redis.set(this._key(key), 'locked');
	}

	async _has(key) {
		const exists = await this.redis.exists(this._key(key));
		return !!exists;
	}

	async _del(key) {
		return this.redis.del(this._key(key));
	}

	_addToQueue(key) {
		let id;
		if (!this.acquireQueue[key]) {
			id = 0;
			this.acquireQueue[key] = [];
		} else {
			const queueLength = this.acquireQueue[key].length;
			id = (this.acquireQueue[key][queueLength - 1] + 1) % Number.MAX_SAFE_INTEGER;
		}
		this.acquireQueue[key].push(id);
		return id;
	}

	async _handleRelease(key) {
		if (!this.acquireQueue[key]) return;

		const id = this.acquireQueue[key][0];
		if (await this.tryAcquire(key)) {
			this.emit(`acquired:${id}`, true);
			this.acquireQueue[key].shift();
			if (!this.acquireQueue[key].length) delete this.acquireQueue[key];
		}
	}

	async tryAcquire(key) {
		if (this.fetching[key]) return false;
		this.fetching[key] = true;

		if (await this._has(key)) {
			delete this.fetching[key];
			return false;
		}

		await this._set(key);
		delete this.fetching[key];
		return true;
	}

	async acquire(key) {
		if (await this.tryAcquire(key)) return true;
		const id = this._addToQueue(key);
		return new Promise(resolve => {
			this.once(`acquired:${id}`, resolve);
		});
	}

	async release(key) {
		const deleted = await this._del(key);
		if (deleted) this.emit('released', key);
	}
}

exports.default = Lock;