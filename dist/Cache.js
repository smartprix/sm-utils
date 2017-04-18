Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /* eslint-disable guard-for-in */


let globalCache;

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

	get(key, defaultValue = undefined) {
		var _this = this;

		return _asyncToGenerator(function* () {
			if (key in _this.data) return _this.data[key];
			return defaultValue;
		})();
	}

	set(key, value, ttl = 0) {
		var _this2 = this;

		return _asyncToGenerator(function* () {
			if (ttl <= 0) {
				_this2.data[key] = value;
				return;
			}

			_this2.set(key, value);

			if (!_this2.ttl) _this2.ttl = new TTL();
			_this2.ttl.set(key, ttl, function () {
				return _this2.del(key);
			});
		})();
	}

	del(key) {
		var _this3 = this;

		return _asyncToGenerator(function* () {
			if (_this3.ttl) _this3.ttl.del(key);
			delete _this3.cache[key];
		})();
	}

	has(key) {
		var _this4 = this;

		return _asyncToGenerator(function* () {
			return key in _this4.data;
		})();
	}

	clear() {
		var _this5 = this;

		return _asyncToGenerator(function* () {
			if (_this5.ttl) _this5.ttl.clear();
			_this5.data = {};
		})();
	}

	size() {
		var _this6 = this;

		return _asyncToGenerator(function* () {
			return Object.keys(_this6.cache).length;
		})();
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

	set(key, value, ttl = 0) {
		var _this7 = this;

		return _asyncToGenerator(function* () {
			if (value && value.then) {
				// value is a Promise
				// resolve it and then cache it
				if (!_this7.events) _this7.events = new _events2.default();
				_this7.fetching[key] = true;
				try {
					const resolvedValue = yield value;
					yield _this7.store.set(key, resolvedValue, ttl);

					delete _this7.fetching[key];
					_this7.events.emit(`get:${key}`, { value: resolvedValue });

					return true;
				} catch (error) {
					// Ignore Error
					delete _this7.fetching[key];
					_this7.events.emit(`get:${key}`, { error });
					return false;
				}
			}

			yield _this7.store.set(key, value, ttl);
			return true;
		})();
	}

	del(key) {
		var _this8 = this;

		return _asyncToGenerator(function* () {
			return _this8.store.del(key);
		})();
	}

	size() {
		var _this9 = this;

		return _asyncToGenerator(function* () {
			return _this9.store.size();
		})();
	}

	clear() {
		var _this10 = this;

		return _asyncToGenerator(function* () {
			return _this10.store.clear();
		})();
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