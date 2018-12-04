// taken from: https://github.com/sindresorhus/p-lazy

/**
 * Create a lazy promise that defers execution until .then() or .catch() is called
 * @ignore
 */
class PLazy extends Promise {
	/**
	 * Same as the Promise constructor. PLazy is a subclass of Promise.
	 */
	constructor(executor) {
		super((resolve) => {
			resolve();
		});

		this._executor = executor;
		this._promise = null;
	}

	static from(fn) {
		return new PLazy((resolve) => {
			resolve(fn());
		});
	}

	then(onFulfilled, onRejected) {
		this._promise = this._promise || new Promise(this._executor);
		return this._promise.then(onFulfilled, onRejected);
	}

	catch(onRejected) {
		this._promise = this._promise || new Promise(this._executor);
		return this._promise.catch(onRejected);
	}
}

export default PLazy;
