/* eslint-disable max-lines, no-mixed-operators, complexity, max-statements */
// taken from: https://github.com/Salakar/denque
// LICENSE: http://www.apache.org/licenses/LICENSE-2.0

/**
 * Custom implementation of a double ended queue.
 * @class
 */
class DeQueue {
	/**
	 * @param {any[]} array
	 */
	constructor(array) {
		this._head = 0;
		this._tail = 0;
		this._capacityMask = 0x3;
		this._list = new Array(4);
		if (Array.isArray(array)) {
			this._fromArray(array);
		}
	}

	/**
	 * Returns the item at the specified index from the list.
	 * 0 is the first element, 1 is the second, and so on...
	 * Elements at negative values are that many from the end: -1 is one before the end
	 * (the last element), -2 is two before the end (one before last), etc.
	 * @param index
	 * @return {*}
	 */
	peekAt(index) {
		let i = index;
		// expect a number or return undefined
		if ((i !== (i | 0))) {
			return undefined;
		}

		const len = this.size();
		if (i >= len || i < -len) return undefined;
		if (i < 0) i += len;
		i = (this._head + i) & this._capacityMask;
		return this._list[i];
	}

	/**
	 * Alias for peakAt()
	 * @param i
	 * @return {*}
	 */
	get(i) {
		return this.peekAt(i);
	}

	/**
	 * Sets the queue value at a particular index
	 *
	 * @param {number} index integer
	 * @param {*} value
	 * @return {*}
	 */
	set(index, value) {
		let i = index;
		// expect a number or return undefined
		if ((i !== (i | 0))) {
			throw new Error('index must be a number');
		}

		const len = this.size();
		if (i >= len || i < -len) {
			throw new Error('index out of bounds');
		}
		if (i < 0) i += len;
		i = (this._head + i) & this._capacityMask;
		const old = this._list[i];
		this._list[i] = value;
		return old;
	}

	/**
	 * Returns the first item in the list without removing it.
	 * @return {*}
	 */
	peek() {
		if (this._head === this._tail) return undefined;
		return this._list[this._head];
	}

	/**
	 * Alias for peek()
	 * @return {*}
	 */
	peekFront() {
		return this.peek();
	}

	/**
	 * Alias for peek()
	 * @return {*}
	 */
	head() {
		return this.peek();
	}

	/**
	 * Returns the item that is at the back of the queue without removing it.
	 * Uses peekAt(-1)
	 */
	peekBack() {
		return this.peekAt(-1);
	}

	/**
	 * Alias for peekBack()
	 * @return {*}
	 */
	tail() {
		return this.peekBack();
	}

	/**
	 * Return the number of items on the list, or 0 if empty.
	 * @return {number}
	 */
	size() {
		if (this._head === this._tail) return 0;
		if (this._head < this._tail) return this._tail - this._head;
		return (this._capacityMask + 1) - (this._head - this._tail);
	}

	/**
	 * alias for this.size()
	 */
	get length() {
		return this.size();
	}

	/**
	 * Add an item at the beginning of the list.
	 * @param item
	 */
	unshift(item) {
		if (item === undefined) return this.size();
		const len = this._list.length;
		this._head = (this._head + (len - 1)) & this._capacityMask;
		this._list[this._head] = item;

		if (this._tail === this._head) this._growArray();
		if (this._head < this._tail) return this._tail - this._head;
		return (this._capacityMask + 1) - (this._head - this._tail);
	}

	/**
	 * Remove and return the first item on the list
	 * Returns undefined if the list is empty.
	 * @return {*}
	 */
	shift() {
		const head = this._head;
		if (head === this._tail) return undefined;
		const item = this._list[head];
		this._list[head] = undefined;
		this._head = (head + 1) & this._capacityMask;
		if (
			head < 2 &&
			this._tail > 10000 &&
			this._tail <= this._list.length >>> 2
		) this._shrinkArray();
		return item;
	}

	/**
	 * Alias for shift()
	 */
	dequeue() {
		return this.shift();
	}

	/**
	 * Add an item to the bottom of the list.
	 * @param item
	 */
	push(item) {
		if (item === undefined) return this.size();
		const tail = this._tail;
		this._list[tail] = item;
		this._tail = (tail + 1) & this._capacityMask;
		if (this._tail === this._head) {
			this._growArray();
		}

		if (this._head < this._tail) return this._tail - this._head;
		return (this._capacityMask + 1) - (this._head - this._tail);
	}

	/**
	 * Alias for push()
	 */
	enqueue() {
		return this.push();
	}

	/**
	 * Remove and return the last item on the list.
	 * Returns undefined if the list is empty.
	 * @return {*}
	 */
	pop() {
		const tail = this._tail;
		if (tail === this._head) return undefined;
		const len = this._list.length;
		this._tail = (tail + (len - 1)) & this._capacityMask;
		const item = this._list[this._tail];
		this._list[this._tail] = undefined;
		if (this._head < 2 && tail > 10000 && tail <= len >>> 2) this._shrinkArray();
		return item;
	}

	/**
	 * Remove and return the item at the specified index from the list.
	 * Returns undefined if the list is empty.
	 * @param index
	 * @return {*}
	 */
	removeOne(index) {
		let i = index;
		// expect a number or return undefined
		if ((i !== (i | 0))) {
			return undefined;
		}
		if (this._head === this._tail) return undefined;
		const size = this.size();
		const len = this._list.length;
		if (i >= size || i < -size) return undefined;
		if (i < 0) i += size;
		i = (this._head + i) & this._capacityMask;
		const item = this._list[i];
		let k;
		if (index < size / 2) {
			for (k = index; k > 0; k--) {
				this._list[i] = this._list[i = (i - 1 + len) & this._capacityMask];
			}
			this._list[i] = undefined;
			this._head = (this._head + 1 + len) & this._capacityMask;
		}
		else {
			for (k = size - 1 - index; k > 0; k--) {
				this._list[i] = this._list[i = (i + 1 + len) & this._capacityMask];
			}
			this._list[i] = undefined;
			this._tail = (this._tail - 1 + len) & this._capacityMask;
		}
		return item;
	}

	/**
	 * Remove number of items from the specified index from the list.
	 * Returns array of removed items.
	 * Returns undefined if the list is empty.
	 * @param index
	 * @param count
	 * @return {array}
	 */
	remove(index, count) {
		if (count === 1 || !count) {
			return this.removeOne(index);
		}

		let i = index;
		let removed;
		let delCount = count;
		// expect a number or return undefined
		if ((i !== (i | 0))) {
			return undefined;
		}
		if (this._head === this._tail) return undefined;
		const size = this.size();
		const len = this._list.length;
		if (i >= size || i < -size || count < 1) return undefined;
		if (i < 0) i += size;
		if (i === 0 && i + count >= size) {
			removed = this.toArray();
			this.clear();
			return removed;
		}
		if (i + count > size) count = size - i;
		let k;
		removed = new Array(count);
		for (k = 0; k < count; k++) {
			removed[k] = this._list[(this._head + i + k) & this._capacityMask];
		}
		i = (this._head + i) & this._capacityMask;
		if (index + count === size) {
			this._tail = (this._tail - count + len) & this._capacityMask;
			for (k = count; k > 0; k--) {
				this._list[i = (i + 1 + len) & this._capacityMask] = undefined;
			}
			return removed;
		}
		if (index === 0) {
			this._head = (this._head + count + len) & this._capacityMask;
			for (k = count - 1; k > 0; k--) {
				this._list[i = (i + 1 + len) & this._capacityMask] = undefined;
			}
			return removed;
		}
		if (index < size / 2) {
			this._head = (this._head + index + count + len) & this._capacityMask;
			for (k = index; k > 0; k--) {
				this.unshift(this._list[i = (i - 1 + len) & this._capacityMask]);
			}
			i = (this._head - 1 + len) & this._capacityMask;
			while (delCount > 0) {
				this._list[i = (i - 1 + len) & this._capacityMask] = undefined;
				delCount--;
			}
		}
		else {
			this._tail = i;
			i = (i + count + len) & this._capacityMask;
			for (k = size - (count + index); k > 0; k--) {
				this.push(this._list[i++]);
			}
			i = this._tail;
			while (delCount > 0) {
				this._list[i = (i + 1 + len) & this._capacityMask] = undefined;
				delCount--;
			}
		}
		if (this._head < 2 && this._tail > 10000 && this._tail <= len >>> 2) this._shrinkArray();
		return removed;
	}

	/**
	 * Native splice implementation.
	 * Remove number of items from the specified index from the list and/or add new elements.
	 * Returns array of removed items or empty array if count == 0.
	 * Returns undefined if the list is empty.
	 *
	 * @param index
	 * @param count
	 * @param {Array<*>} args
	 * @return {array}
	 */
	splice(index, count, ...args) {
		if (!args.length) {
			return this.remove(index, count);
		}

		let i = index;
		// expect a number or return undefined
		if ((i !== (i | 0))) {
			return undefined;
		}
		const size = this.size();
		if (i < 0) i += size;
		if (i > size) return undefined;

		let k;
		let temp;
		let removed;
		let argLen = args.length;
		const len = this._list.length;
		let argumentsIndex = 0;
		if (!size || i < size / 2) {
			temp = new Array(i);
			for (k = 0; k < i; k++) {
				temp[k] = this._list[(this._head + k) & this._capacityMask];
			}
			if (count === 0) {
				removed = [];
				if (i > 0) {
					this._head = (this._head + i + len) & this._capacityMask;
				}
			}
			else {
				removed = this.remove(i, count);
				this._head = (this._head + i + len) & this._capacityMask;
			}
			while (argLen > argumentsIndex) {
				this.unshift(args[--argLen]);
			}
			for (k = i; k > 0; k--) {
				this.unshift(temp[k - 1]);
			}
		}
		else {
			temp = new Array(size - (i + count));
			const leng = temp.length;
			for (k = 0; k < leng; k++) {
				temp[k] = this._list[(this._head + i + count + k) & this._capacityMask];
			}
			if (count === 0) {
				removed = [];
				if (i !== size) {
					this._tail = (this._head + i + len) & this._capacityMask;
				}
			}
			else {
				removed = this.remove(i, count);
				this._tail = (this._tail - leng + len) & this._capacityMask;
			}
			while (argumentsIndex < argLen) {
				this.push(args[argumentsIndex++]);
			}
			for (k = 0; k < leng; k++) {
				this.push(temp[k]);
			}
		}
		return removed;
	}

	/**
	 * Soft clear - does not reset capacity.
	 */
	clear() {
		this._head = 0;
		this._tail = 0;
	}

	/**
	 * Returns true or false whether the list is empty.
	 * @return {boolean}
	 */
	isEmpty() {
		return this._head === this._tail;
	}

	/**
	 * Returns an array of all queue items.
	 * @return {Array}
	 */
	toArray() {
		return this._copyArray(false);
	}

	/**
	 * Returns an iterator of all queue items.
	 * @return {iterator}
	 * @private
	 */
	* [Symbol.iterator]() {
		const list = this._list;
		const len = list.length;
		let i;
		if (this._head > this._tail) {
			for (i = this._head; i < len; i++) yield list[i];
			for (i = 0; i < this._tail; i++) yield list[i];
		}
		else {
			for (i = this._head; i < this._tail; i++) yield list[i];
		}
	}

	forEach(callback) {
		let i = 0;
		for (const value of this) {
			callback(value, i++, this);
		}
	}

	map(callback) {
		let i = 0;
		const result = [];
		for (const value of this) {
			result.push(callback(value, i++, this));
		}
		return result;
	}

	filter(callback) {
		let i = 0;
		const result = [];
		callback = callback || Boolean;
		for (const value of this) {
			if (callback(value, i++, this)) {
				result.push(value);
			}
		}
		return result;
	}

	/**
	 * -------------
	 *   INTERNALS
	 * -------------
	 */

	/**
	 * Fills the queue with items from an array
	 * For use in the constructor
	 * @param array
	 * @private
	 */
	_fromArray(array) {
		for (let i = 0; i < array.length; i++) this.push(array[i]);
	}

	/**
	 *
	 * @param fullCopy
	 * @return {Array}
	 * @private
	 */
	_copyArray(fullCopy) {
		const newArray = [];
		const list = this._list;
		const len = list.length;
		let i;
		if (fullCopy || this._head > this._tail) {
			for (i = this._head; i < len; i++) newArray.push(list[i]);
			for (i = 0; i < this._tail; i++) newArray.push(list[i]);
		}
		else {
			for (i = this._head; i < this._tail; i++) newArray.push(list[i]);
		}
		return newArray;
	}

	/**
	 * Grows the internal list array.
	 * @private
	 */
	_growArray() {
		if (this._head) {
			// copy existing data, head to end, then beginning to tail.
			this._list = this._copyArray(true);
			this._head = 0;
		}

		// head is at 0 and array is now full, safe to extend
		this._tail = this._list.length;

		this._list.length *= 2;
		this._capacityMask = (this._capacityMask << 1) | 1;
	}

	/**
	 * Shrinks the internal list array.
	 * @private
	 */
	_shrinkArray() {
		this._list.length >>>= 1;
		this._capacityMask >>>= 1;
	}
}

export default DeQueue;
