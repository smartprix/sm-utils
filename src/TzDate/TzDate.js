const originalOffset = new Date().getTimezoneOffset();
const _Date = Date;

class TzDate extends Date {
	static timezoneOffset = originalOffset;

	constructor(...args) {
		super();

		let date;
		if (args.length === 0) {
			date = new _Date();
		}
		else if (args.length === 1) {
			if (typeof args[0] === 'string') {
				// eslint-disable-next-line no-this-before-super
				date = new _Date(TzDate._parse(args[0], this._getTimezoneDiff()));
			}
			else {
				date = new _Date(args[0]);
			}
		}
		else {
			date = new _Date(_Date.UTC(...args) + this._getUTCDiff());
		}

		this.date = date;
	}

	_mutateDate(method, ...args) {
		this.offsetDate = null;
		return this.date[method](...args);
	}

	_mutateOffsetDate(method, ...args) {
		this.date = null;
		return this.offsetDate[method](...args) - this._getTimezoneDiff();
	}

	_getDate() {
		this.date = this.date || (
			new _Date(this.offsetDate.getTime() - this._getTimezoneDiff())
		);
		return this.date;
	}

	_getOffsetDate() {
		this.offsetDate = this.offsetDate || (
			new _Date(this.date.getTime() + this._getTimezoneDiff())
		);
		return this.offsetDate;
	}

	_getTimezoneStr() {
		// note: javascript timezones are reversed
		// so +0530 would be -330
		const timezoneOffset = this.getTimezoneOffset();
		const sign = timezoneOffset <= 0 ? '+' : '-';
		const hours = Math.floor(Math.abs(timezoneOffset) / 60);
		const hourStr = hours < 10 ? `0${hours}` : `${hours}`;
		const minutes = Math.abs(timezoneOffset) - (hours * 60);
		const minuteStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
		return `${sign}${hourStr}${minuteStr}`;
	}

	static _parse(str, timezoneDiff) {
		if (/(?:[0-9]Z)|(?:T[0-9])|(?:[+-][0-9]{4})/.test(str)) {
			return _Date.parse(str);
		}

		return _Date.parse(str) - timezoneDiff;
	}

	static parse(str) {
		if (typeof str === 'string') return this._parse(str);
		return _Date.parse(str, (originalOffset - this.timezoneOffset) * 60 * 1000);
	}

	static setTimezoneOffset(offset) {
		this.timezoneOffset = offset;
	}

	static getTimezoneOffset() {
		return this.timezoneOffset;
	}

	getTimezoneOffset() {
		return this.timezoneOffset || this.constructor.timezoneOffset;
	}

	setTimezoneOffset(offset) {
		this.timezoneOffset = offset;
		this.offsetDate = null;
	}

	_getTimezoneDiff() {
		return (originalOffset - this.getTimezoneOffset()) * 60 * 1000;
	}

	_getUTCDiff() {
		return this.getTimezoneOffset() * 60 * 1000;
	}

	toString() {
		return this._getOffsetDate().toString()
			.replace(/[+-][0-9]{4}\s*(?:\([A-Z]+\))?/, this._getTimezoneStr());
	}

	toUTCString() {
		return this._getDate().toUTCString();
	}

	toISOString() {
		return this._getDate().toISOString();
	}

	toJSON() {
		return this._getDate().toISOString();
	}

	toLocaleString() {
		return this._getOffsetDate().toLocaleString();
	}

	toDateString() {
		return this._getOffsetDate().toDateString();
	}

	toLocaleDateString() {
		return this._getOffsetDate().toLocaleDateString();
	}

	toTimeString() {
		return this._getOffsetDate().toTimeString()
			.replace(/[+-][0-9]{4}\s*(?:\([A-Z]+\))?/, this._getTimezoneStr());
	}

	toLocaleTimeString() {
		return this._getOffsetDate().toLocaleTimeString();
	}

	valueOf() {
		return this._getDate().valueOf();
	}

	getTime() {
		return this._getDate().getTime();
	}

	setTime(time) {
		return this._mutateDate('setTime', time);
	}
}

const methods = [
	'Milliseconds',
	'Seconds',
	'Minutes',
	'Hours',
	'Date',
	'Month',
	'FullYear',
	'Year',
	'Day',
];

methods.forEach((method) => {
	TzDate.prototype['get' + method] = function () {
		return this._getOffsetDate()['get' + method]();
	};

	TzDate.prototype['getUTC' + method] = function () {
		return this._getDate()['getUTC' + method]();
	};

	TzDate.prototype['set' + method] = function (...args) {
		return this._mutateOffsetDate('set' + method, ...args);
	};

	TzDate.prototype['setUTC' + method] = function (...args) {
		return this._mutateDate('setUTC' + method, ...args);
	};
});
