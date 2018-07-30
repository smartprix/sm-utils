const originalExit = process.exit.bind(process);
const timeout = 1;
process.exit = function (code) {
	const timer = setTimeout(() => {
		console.error('timed out');
		originalExit(code);
	});

	batcher.clear().then(() => {
		originalExit(code);
	}).catch((err) => {
		console.error(err);
		originalExit(code);
	});
}

class Batcher {
	/**
	 *
	 * @param {function} executor
	 * @param {object} options
	 *  maxKeys: maximum number of keys before calling executor
	 *  maxCalls: maximum number of calls to any function before calling executor
	 *  maxValues: maximum number of values before calling executor
	 *  maxInterval: Maximum interval to wait before calling executor
	 *  executeOnExit: execute batcher on exit even if data is not complete
	 */
	constructor(executor, options = {}) {
		this.executor = executor;
		this.map = new Map();
		this.options = options;
		this._setInterval();
		this.resetCounts();
	}

	execute() {
		this._setInterval();
		this.resetCounts();

		if (!this.map.size) {
			return;
		}

		const map = this.map;
		this.map = new Map();

		return Promise.resolve()
			.then(() => this.executor(map))
			.then(() => {})
			.catch((err) => {
				console.error(err);
			});
	}

	resetCounts() {
		this.keysCount = 0;
		this.callsCount = 0;
		this.valuesCount = 0;
	}

	_incrementKeyCount(count = 1) {
		this.keysCount += count;
		if (this.options.maxKeys && this.options.maxKeys <= this.keysCount) {
			this.execute();
		}
	}

	_incrementValueCount(count = 1) {
		this.keysCount += count;
		if (this.options.maxValues && this.options.maxValues <= this.valuesCount) {
			this.execute();
		}
	}

	_incrementCallCount(count = 1) {
		this.keysCount += count;
		if (this.options.maxCalls && this.options.maxCalls <= this.callsCount) {
			this.execute();
		}
	}

	_setInterval() {
		if (this.options.maxInterval) {
			if (this.timer) {
				clearTimeout(this.timer);
			}
			this.timer = setTimeout(this.execute.bind(this), this.options.maxInterval);
		}
	}

	increment(key, count = 1) {
		let item = this.map.get(key);
		if (!item) {
			item = 0;
			this.map.set(key, item);
			this._incrementKeyCount();
			this._incrementValueCount();
		}

		this.set(key, item + count);
		this._incrementCallCount();
	}

	decrement(key, count = 1) {
		this.increment(0 - count);
	}

	set(key, value) {
		if (!this.map.has(key)) {
			this._incrementKeyCount();
			this._incrementValueCount();
		}

		this.map.set(key, value);
		this._incrementCallCount();
	}

	push(key, value) {
		let item = this.map.get(key);
		if (!item) {
			item = [];
			this.map.set(key, item);
			this._incrementKeyCount();
		}

		item.push(value);
		this._incrementValueCount();
		this._incrementCallCount();
	}

	pushAll(key, value) {
		let item = this.map.get(key);
		if (!item) {
			item = [];
			this.map.set(key, item);
			this._incrementKeyCount();
		}

		value.forEach((val) => {
			item.push(value);
			this._incrementValueCount();
			this._incrementCallCount();
		});
	}

	pushUniq(key, value) {
		let item = this.map.get(key);
		if (!item) {
			item = [];
			this.map.set(key, item);
			this._incrementKeyCount();
		}

		if (!item.includes(value)) {
			item.push(value);
			this._incrementValueCount();
		}
		this._incrementCallCount();
	}

	pushAllUniq(key, value) {
		let item = this.map.get(key);
		if (!item) {
			item = [];
			this.map.set(key, item);
			this._incrementKeyCount();
		}

		value.forEach((val) => {
			if (!item.includes(value)) {
				item.push(value);
				this._incrementValueCount();
			}
			this._incrementCallCount();
		});
	}

	modify(key, func) {
		let originalItem = this.map.get(key);

		const item = func(originalItem, this.map);
		if (item === undefined) {
			this.delete(key);
			return;
		}

		if (originalItem !== undefined) {
			this._incrementKeyCount();
			this._incrementValueCount();
		}

		this.map.set(key, item);
		this._incrementCallCount();
	}

	has(key) {
		return this.map.has(key);
	}

	get(key) {
		return this.map.get(key);
	}

	delete(key) {
		if (!this.map.has(key)) {
			return;
		}

		this.map.delete(key);
		this._incrementValueCount(-1);
		this._incrementKeyCount(-1);
	}

	destroy() {
		if (this.timer) {
			clearTimeout(this.timer);
		}
	}
}
