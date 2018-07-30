// taken from: https://github.com/sindresorhus/p-lazy

/**
 * Create a lazy promise that defers execution until .then() or .catch() is called
 */

class TimeoutError extends Error {
	constructor(message = 'Timed Out') {
		super(message);
		this.code = 'E_TIMEOUT';
	}

	static ms(interval) {
		return new TimeoutError(`Promise timed out after ${interval} ms`);
	}
}

class PromisePlus extends Promise {
	/**
	 * Same as the Promise constructor. PromisePlus is a subclass of Promise.
	 */
	constructor(executor, options = {}) {
		this._options = options;

		if (options.lazy) {
			super((resolve) => {
				resolve();
			});

			this._executor = executor;
			this._promise = null;
		}
		else {
			this._setTimeout();
			super(executor);
			this._promise = this;
		}
	}

	static from(fn, options = {}) {
		return new PromisePlus((resolve) => {
			if (typeof fn === 'function') {
				resolve(fn());
				return;
			}
			resolve(fn);
		}, options);
	}

	_getPromise() {
		if (!this._promise) {
			this._setTimeout();
			this._promise = new Promise(this._executor);
		}
		return this._promise;
	}

	_setTimeout() {
		if (!this._options.timeout) return;

		const timer = setTimeout(() => {
			reject(TimeoutError.ms(timeout));
			if (this._options.onTimeout) {
				this._options.onTimeout();
			}
		}, timeout);

		this.finally(
			() => { clearTimeout(timer) },
		);
	}

	then(onFulfilled, onRejected) {
		return this._getPromise().then(onFulfilled, onRejected);
	}

	catch(errorClass, onRejected) {
		// errorClass is actually onRejected function
		if (typeof errorClass === 'function' && !(errorClass instanceof Error)) {
			return this._getPromise().catch(errorClass);
		}

		if (!Array.isArray(errorClass)) {
			errorClass = [errorClass];
		}

		const handler = (err) => {
			if (!err) return;
			for (const cls of errorClass) {
				if (
					err instanceof errorClass ||
					err.name === cls ||
					err.code === cls
				) {
					onRejected && onRejected(err);
					return;
				}
			}
			throw err;
		};
		return this._getPromise().catch(handler);
	}

	finally(onFinally) {
		if (!onFinally) return this;
		if (Promise.prototype.finally) {
			return this._getPromise().finally(onFinally);
		}

		return this.then(
			val => Promise.resolve(onFinally()).then(() => val),
			err => Promise.resolve(onFinally()).then(() => {
				throw err;
			})
		);
	}

	timeout(time, onTimeout) {
		this._options.timeout = time;
		this._options.onTimeout = onTimeout;
	}

	catchTimeout(callback) {
		return this.catch(TimeoutError, callback);
	}

	catchCancel(callback) {
		return this.catch(CancelError, callback);
	}
}

export default PLazy;
