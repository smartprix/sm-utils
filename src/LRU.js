/**
 * A Simple LRU Map
 * This maintains 2 maps internally and swaps them when one becomes full
 * NOTE: At any time size of the map will be from 0 to 2 * maxItems
 *
 * @example
 * const lru = new LRU({maxItems: 1000});
 * lru.set('hello', 'world');
 * lru.get('hello');
 * lru.delete('hello');
 */
class LRU {
	/**
	 * @param {object} [options={}]
	 * @param {number} [options.maxItems] max items in the lru map
	 */
	constructor(options = {}) {
		if (!(options.maxItems && options.maxItems > 0)) {
			throw new TypeError('`maxItems` must be a number greater than 0');
		}

		this.maxItems = options.maxItems;
		this.cache = new Map();
		this.oldCache = new Map();
		this._size = 0;
	}

	_set(key, value) {
		this.cache.set(key, value);

		if (this.cache.size >= this.maxItems) {
			this._size = this.cache.size;
			this.oldCache = this.cache;
			this.cache = new Map();
		}
	}

	/**
	 * gets a value from the lru map
	 * @param {any} key
	 * @returns {any}
	 */
	get(key) {
		const value = this.cache.get(key);
		if (value !== undefined) return value;

		const oldValue = this.oldCache.get(key);
		if (oldValue) {
			this._set(key, oldValue);
			return oldValue;
		}

		return undefined;
	}

	/**
	 * sets a value in the lru map
	 * @param {any} key
	 * @param {any} value
	 */
	set(key, value) {
		if (this.cache.has(key)) {
			this.cache.set(key, value);
		}
		else {
			this._size++;
			this._set(key, value);
		}

		return this;
	}

	/**
	 * returns whether a value exists in the lru map
	 * @param {any} key
	 * @returns {boolean}
	 */
	has(key) {
		return this.cache.has(key) || this.oldCache.has(key);
	}

	/**
	 * gets a value from the lru map without touching the lru sequence
	 * @param {any} key
	 * @returns {any}
	 */
	peek(key) {
		const value = this.cache.get(key);
		if (value !== undefined) return value;

		const oldValue = this.oldCache.get(key);
		if (oldValue) return oldValue;

		return undefined;
	}

	/**
	 * deletes a value from the lru map
	 * @param {any} key
	 * @returns {boolean} whether any key was deleted
	 */
	delete(key) {
		const newDeleted = this.cache.delete(key);
		const oldDeleted = this.oldCache.delete(key);
		const deleted = oldDeleted || newDeleted;
		if (deleted) {
			this._size--;
		}

		return deleted;
	}

	/**
	 * removes all values from the lru map
	 */
	clear() {
		this.cache.clear();
		this.oldCache.clear();
		this._size = 0;
	}

	/**
	 * return an iterator over the keys of the lru map
	 */
	* keys() {
		for (const [key] of this) {
			yield key;
		}
	}

	/**
	 * return an iterator over the values of the lru map
	 */
	* values() {
		for (const [, value] of this) {
			yield value;
		}
	}

	/**
	 * return an iterator over the entries (key, value) of the lru map
	 */
	* [Symbol.iterator]() {
		for (const item of this.cache) {
			yield item;
		}

		for (const item of this.oldCache) {
			const [key] = item;
			if (!this.cache.has(key)) {
				yield item;
			}
		}
	}

	/**
	 * returns the size of the lru map (number of items in the map)
	 * @returns {number}
	 */
	get size() {
		return this._size;
	}

	/**
	 * Total size (including old + new) of the LRU cache
	 * @returns {number}
	 */
	totalSize() {
		return this.cache.size + this.oldCache.size;
	}
}

module.exports = LRU;
