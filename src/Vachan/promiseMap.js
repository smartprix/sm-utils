// taken from: https://github.com/sindresorhus/p-map
import _ from 'lodash';

/**
 * Returns a Promise that is fulfilled when all promises in input
 * and ones returned from mapper are fulfilled, or rejects if any
 * of the promises reject. The fulfilled value is an Array of the
 * fulfilled values returned from mapper in input order.
 *
 * @param {array|object|map|set|iterable} iterable collection to iterate over
 * @param {function} mapper The function invoked per iteration, should return a promise
 * 	mapper is invoked with (value, index|key, iterable)
 * @param {object} options object of {concurrency}
 * 	concurrency: Number of maximum concurrently running promises, default is Infinity
 * @returns {Promise(array)} a promise that resolves to an array of results
 */
function promiseMap(iterable, mapper, options = {}) {
	return new Promise((resolve, reject) => {
		const concurrency = options.concurrency || options.concurrancy || Infinity;

		if (typeof mapper !== 'function') {
			throw new TypeError('Mapper function is required');
		}
		if (!(typeof concurrency === 'number' && concurrency >= 1)) {
			throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${concurrency}\` (${typeof concurrency})`);
		}

		let iterator;
		const ret = [];
		let isRejected = false;
		let iterableDone = false;
		let resolvingCount = 0;
		let currentIdx = 0;
		let isMap = iterable instanceof Map;

		if (iterable[Symbol.iterator]) {
			iterator = iterable[Symbol.iterator]();
		}
		else if (_.isPlainObject(iterable)) {
			const entries = Object.entries(iterable);
			iterator = entries[Symbol.iterator]();
			isMap = true;
		}
		else {
			throw new Error('Expected iterable to be an iterable object');
		}

		const next = () => {
			if (isRejected) {
				return;
			}

			const nextItem = iterator.next();
			const i = currentIdx;
			currentIdx++;

			if (nextItem.done) {
				iterableDone = true;

				if (resolvingCount === 0) {
					resolve(ret);
				}

				return;
			}

			resolvingCount++;

			Promise.resolve(nextItem.value)
				.then((el) => {
					if (isMap) {
						return mapper(el[1], el[0], iterable);
					}
					return mapper(el, i, iterable);
				})
				.then((val) => {
					ret[i] = val;
					resolvingCount--;
					next();
				}, (err) => {
					isRejected = true;
					reject(err);
				});
		};

		for (let i = 0; i < concurrency; i++) {
			next();

			if (iterableDone) {
				break;
			}
		}
	});
}

function promiseMapKeys(iterable, mapper, options = {}) {
	const result = {};
	return promiseMap(
		iterable,
		() => {	// eslint-disable-line
			return (value, key, iter) => mapper(value, key, iter).then((res) => {
				result[res] = value;
				return res;
			});
		},
		options
	).then(() => result);
}

function promiseMapValues(iterable, mapper, options = {}) {
	const result = {};
	return promiseMap(
		iterable,
		() => {	// eslint-disable-line
			return (value, key, iter) => mapper(value, key, iter).then((res) => {
				result[key] = res;
				return res;
			});
		},
		options
	).then(() => result);
}

export {
	promiseMap,
	promiseMapKeys,
	promiseMapValues,
};
