
import {promiseMap, promiseMapKeys, promiseMapValues} from './promiseMap';
import PLazy from './lazy';

class TimeoutError extends Error {
	constructor(message = 'Timed Out') {
		super(message);
		this.code = 'E_TIMEOUT';
	}

	static ms(interval) {
		return new TimeoutError(`Promise timed out after ${interval} ms`);
	}
}

/**
 * Promise utility functions
 */
class Vachan {
	/**
	 * identity function is to make sure returned value is a promise.
	 * returns the following if the input is a:
	 * - promise: returns the promise itself
	 * - function: executes the function and returns the result wrapped in a promise
	 * - any: returns the input wrapped in a promise
	 *
	 * @param {function|Promise<*>|any} promise
	 * @returns {Promise<*>}
	 */
	static identity(promise) {
		if (promise && promise.then) {
			return promise;
		}
		if (typeof promise === 'function') {
			try {
				return Vachan.identity(promise());
			}
			catch (e) {
				return Promise.reject(e);
			}
		}
		return Promise.resolve(promise);
	}

	/**
	 * Execute a promise / function, and exit when it completes
	 * @param {Promise<*>|function} promise
	 * @param {object} options
	 */
	static exit(promise, options = {}) {
		this.identity(promise).then(() => {
			process.exit(0);
		}).catch((err) => {
			if (!options.silent) {
				console.error(err);
			}
			process.exit(1);
		});
	}

	/**
	 * Execute a promise / function, without caring about its results
	 * @param {Promise<*>|function} promise
	 * @param {object} options
	 */
	static exec(promise, options = {}) {
		this.identity(promise).then(() => {}).catch((err) => {
			if (!options.silent) {
				console.error(err);
			}
		});
	}

	/**
	 * create a lazy promise from an executor function ((resolve, reject) => {})
	 * a lazy promise defers execution till .then() or .catch() is called
	 *
	 * @param {function} executor function(resolve, reject) {}, same as promise constructor
	 * @returns {Promise<*>} a lazy promise
	 */
	static lazy(executor) {
		return new PLazy(executor);
	}

	/**
	 * create a lazy promise from an async function
	 * a lazy promise defers execution till .then() or .catch() is called
	 */
	static lazyFrom(asyncFunction) {
		return PLazy.from(asyncFunction);
	}

	/**
	 * Returns a promise that resolves after the specified duration
	 * Can be used to delay / sleep
	 *   Example: await Vachan.sleep(2000);
	 *
	 * @param {number} duration milliseconds to delay for
	 */
	static sleep(duration) {
		return new Promise((resolve) => {
			setTimeout(resolve, duration);
		});
	}

	/**
	 * Promise.finally polyfill
	 * Invoked when the promise is settled regardless of outcome
	 * https://github.com/sindresorhus/p-finally
	 *
	 * @param {Promise<*>} promise
	 * @param {function} onFinally
	 * @returns {Promise<*>} Returns a Promise.
	 */
	static finally(promise, onFinally) {
		if (promise.finally) {
			return promise.finally(onFinally);
		}

		onFinally = onFinally || (() => {});
		return promise.then(
			val => Promise.resolve(onFinally()).then(() => val),
			err => Promise.resolve(onFinally()).then(() => {
				throw err;
			})
		);
	}

	/**
	 * Returns a promise the rejects on specified timeout
	 *
	 * @param {Promise<*>|function} promise A Promise or an async function
	 * @param {object|number} options can be {timeout} or a number
	 *  timeout: Milliseconds before timing out
	 */
	static timeout(promise, options = {}) {
		return new Promise((resolve, reject) => {
			const timeout = (typeof options === 'number') ? options : options.timeout;

			const timer = setTimeout(() => {
				reject(TimeoutError.ms(timeout));
			}, timeout);

			Vachan.finally(
				Vachan.identity(promise).then(resolve, reject),
				() => { clearTimeout(timer) },
			);
		});
	}

	/**
	 * Returns a Promise that resolves when condition returns true.
	 * Rejects if condition throws or returns a Promise that rejects.
	 * https://github.com/sindresorhus/p-wait-for
	 *
	 * @param {function} conditionFn function that returns a boolean
	 * @param {object|number} options can be {interval, timeout} or a number
	 * 	interval: Number of milliseconds to wait before retrying condition (default 50)
	 *  timeout: will reject the promise on timeout (in ms)
	 */
	static waitFor(conditionFn, options = {}) {
		const promise = new Promise((resolve, reject) => {
			const interval = (typeof options === 'number') ? options : (options.interval || 50);
			const check = () => {
				Vachan.identity(conditionFn).then((val) => {
					if (val) {
						resolve();
					}
					else {
						setTimeout(check, interval);
					}
				}).catch(reject);
			};

			check();
		});

		if (options.timeout) {
			return Vachan.timeout(promise, options.timeout);
		}
		return promise;
	}

	/**
	 * Returns an async function that delays calling fn
	 * until after wait milliseconds have elapsed since the last time it was called
	 * https://github.com/sindresorhus/p-debounce
	 *
	 * @param {function} fn function to debounce
	 * @param {number} delay ms to wait before calling fn.
	 * @param {object} options object of {leading, fixed}
	 *  leading: (default false)
	 * 		Call the fn on the leading edge of the timeout.
	 * 		Meaning immediately, instead of waiting for wait milliseconds.
	 *  fixed: fixed delay, each call won't reset the timer to 0
	 */
	static debounce(fn, delay, options = {}) {
		let leadingVal;
		let timer;
		let resolveList = [];

		return function (...args) {
			return new Promise((resolve) => {
				const runImmediately = options.leading && !timer;

				if (timer && options.fixed) {
					resolveList.push(resolve);
					return;
				}

				clearTimeout(timer);
				timer = setTimeout(() => {
					timer = null;
					const res = options.leading ? leadingVal : fn(...args);

					for (resolve of resolveList) {
						resolve(res);
					}

					resolveList = [];
				}, delay);

				if (runImmediately) {
					leadingVal = fn(...args);
					resolve(leadingVal);
				}
				else {
					resolveList.push(resolve);
				}
			});
		};
	}
}

Vachan.map = promiseMap;
Vachan.mapKeys = promiseMapKeys;
Vachan.mapValues = promiseMapValues;

export default Vachan;
