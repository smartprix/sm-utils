import _ from 'lodash';
import numberToWords from './numberToWords';

/**
 * String utilities
 * @namespace Str
 */

/**
 * Inverts the case of a string
 * @example
 * Str.invertCase('Hello iPhone'); // => 'hELLO IpHONE'
 * @memberof Str
 * @param {string} str
 * @return {string}
 */
function invertCase(str) {
	let output = '';
	let code = '';

	for (let i = 0, len = str.length - 1; i <= len; i++) {
		code = str.charCodeAt(i);
		if (code >= 65 && code <= 90) {
			output += str.charAt(i).toLowerCase();
		}
		else if (code >= 97 && code <= 122) {
			output += str.charAt(i).toUpperCase();
		}
		else {
			output += str.charAt(i);
		}
	}

	return output;
}

/**
 * is the character given is a vowel?
 * @example
 * Str.isVowel('a') // => true
 * Str.isVowel('f') // => false
 * Str.isVowel('ae') // => false
 * @memberof Str
 * @param {string} char
 * @return {boolean}
 */
function isVowel(char) {
	return (/^[aeiou]$/i).test(char);
}

/**
 * is the character given is a consonant?
 * @example
 * Str.isConsonant('a') // => false
 * Str.isConsonant('f') // => true
 * Str.isConsonant('ff') // => false
 * @memberof Str
 * @param {string} char
 * @return {boolean}
 */
function isConsonant(char) {
	return (/^[bcdfghjklmnpqrstvwxys]$/i).test(char);
}

/**
 * Get the plural of a string
 * @memberof Str
 * @param {string} str
 * @return {string}
 */
function plural(str) {
	if (!str || str.length <= 2) return str;

	if (str.charAt(str.length - 1) === 'y') {
		if (isVowel(str.charAt(str.length - 2))) {
			// If the y has a vowel before it (i.e. toys), then you just add the s.
			return str + 's';
		}

		// If a this ends in y with a consonant before it (fly)
		// you drop the y and add -ies to make it plural.
		return str.slice(0, -1) + 'ies';
	}
	if (str.substring(str.length - 2) === 'us') {
		// ends in us -> i, needs to preceed the generic 's' rule
		return str.slice(0, -2) + 'i';
	}
	if (
		['ch', 'sh'].indexOf(str.substring(str.length - 2)) !== -1 ||
		['x', 's'].indexOf(str.charAt(str.length - 1)) !== -1
	) {
		// If a this ends in ch, sh, x, s, you add -es to make it plural.
		return str + 'es';
	}

	// anything else, just add s
	return str + 's';
}

/**
 * Pluralize a character if the count is greater than 1
 * @memberof Str
 * @param {string} str
 * @param {number} [count=2]
 * @return {string}
 */
function pluralize(str, count = 2) {
	if (count <= 1) return str;
	return plural(str);
}

/**
 * transform a string by replacing characters from from string to to string
 * @example
 * Str.transform('abc', 'bc', 'de') // => 'ade'
 * @memberof Str
 * @param {string} str string to transform
 * @param {string} from characters to replace in the string
 * @param {string} to characters to replace with in the string
 * @return {string} transformed string
 */
function transform(str, from, to) {
	const len = str.length;
	let out = '';
	let pos;

	for (let i = 0; i < len; i++) {
		pos = from.indexOf(str.charAt(i));
		if (pos >= 0) {
			out += to.charAt(pos);
		}
		else {
			out += str.charAt(i);
		}
	}

	return out;
}

/**
 * Break String From Next Given Character After A Given Position
 * @memberof Str
 * @param {string} str
 * @param {number} pos
 * @param {string} [char=' ']
 * @return {string}
 */
function trimToNext(str, pos, char = ' ') {
	const trimPos = str.indexOf(char, pos);
	if (trimPos !== -1) {
		return _.trimEnd(str.substring(0, trimPos), char);
	}

	return _.trimEnd(str, char);
}

const numberLocaleCache = {};
function _getNumberLocale(options) {
	const {currency = undefined, decimals = 0} = options;

	// If currency is INR, there should not be space between currency symbol and number
	const locale = (currency === 'INR' ? 'hi-IN' : options.locale) || 'en';
	const localeKey = `${locale}${currency}${decimals}`;

	if (!(localeKey in numberLocaleCache)) {
		numberLocaleCache[localeKey] = new Intl.NumberFormat(locale, {
			style: currency ? 'currency' : 'decimal',
			currency,
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	}

	return numberLocaleCache[localeKey];
}

// Countries where Indian Numbering System is used
const indianNumberSystem = [
	'in',	// India
	'mm', 	// Myanmar
	'lk', 	// Sri Lanka
	'bd', 	// Bangladesh
	'np', 	// Nepal
	'pk', 	// Pakistan
];

/**
 * Units should be in desc order of values
 * Key should have suffix 'in' if using indian number system
 */
const abbreviateUnits = {
	longin: {
		' Arab': 1e9,
		' Crore': 1e7,
		' Lakh': 1e5,
	},
	long: {
		' Trillion': 1e12,
		' Billion': 1e9,
		' Million': 1e6,
	},
	shortin: {
		' Arab': 1e9,
		' Cr': 1e7,
		' L': 1e5,
	},
	short: {
		T: 1e12,
		B: 1e9,
		M: 1e6,
	},
	autoin: {
		' Arab': 1e9,
		' Cr': 1e7,
		' Lakh': 1e5,
	},
	auto: {
		' Tn': 1e12,
		' Bn': 1e9,
		' Mn': 1e6,
	},
};

/**
 * @typedef {Object} abbreviateOpts
 * @property {number} number
 * @property {string} [unit]
 * @property {number} [decimals]
 */

/**
 * Abbreviate number
 * @private
 * @param {number} number
 * @returns {abbreviateOpts}
 */
function _abbreviateNumber(number, options) {
	const {locale = 'en', abbr = 'none'} = options;
	const result = {number};
	if (!['long', 'short', 'auto'].includes(abbr)) return result;

	const countryCode = (locale.split('-')[1] || '').toLowerCase();
	const numberSystem = (indianNumberSystem.includes(countryCode)) ? 'in' : '';
	const abbrKey = `${abbr}${numberSystem}`;

	for (const unit of Object.keys(abbreviateUnits[abbrKey])) {
		if (abbreviateUnits[abbrKey][unit] <= number) {
			result.number = number / abbreviateUnits[abbrKey][unit];
			result.unit = unit;
			result.decimals = result.number % 1 ? 2 : 0;
			break;
		}
	}
	return result;
}

/**
 * @typedef {object} numberFormatOpts
 * @property {string} locale like 'en-IN'
 * @property {string} currency like 'INR'
 * @property {number} decimals number of decimal places to return
 * @property {number} abbr option to abbreviate number: ['none', 'auto', 'long', 'short']
 */

/**
 * Format a number according to a particular locale
 * Similar to Number.toLocaleFormat, except being significantly faster
 *
 * @memberof Str
 * @param {number} number the number to format
 * @param {numberFormatOpts|string} [options={}]
 * 	string of locale or options object {locale: 'en', decimals: 0, currency: 'INR', abbr: 'auto'}
 * @return {string} formatted number
 */
function numberFormat(number, options = {}) {
	if (typeof options === 'string') {
		options = {locale: options};
	}
	const abbreviatedNumber = _abbreviateNumber(number, options);
	number = abbreviatedNumber.number;
	options.decimals = abbreviatedNumber.decimals || options.decimals;
	number = _getNumberLocale(options).format(number);
	if (abbreviatedNumber.unit) {
		number = number.replace(
			/[0-9,]+\.?[0-9]*/,
			value => `${value}${abbreviatedNumber.unit}`
		);
	}
	return number;
}

/**
 * Space clean a string
 * Converts consecutive multiple spaces / tabs / newlines in the string into a single space
 * @memberof Str
 * @param {string} str
 * @return {string}
 */
function spaceClean(str) {
	if (!str) return '';
	return str.replace(/(?:\s|&nbsp;|&#32;)+/ig, ' ').trim();
}

/**
 * Rotate a string by 13 characters
 *
 * @memberof Str
 * @param {string} str the string to be rotated
 * @return {string} rotated string
 */
function rot13(str) {
	const s = [];
	for (let i = 0; i < str.length; i++) {
		const j = str.charCodeAt(i);
		if (((j >= 65) && (j <= 77)) || ((j >= 97) && (j <= 109))) {
			s[i] = String.fromCharCode(j + 13);
		}
		else if (((j >= 78) && (j <= 90)) || ((j >= 110) && (j <= 122))) {
			s[i] = String.fromCharCode(j - 13);
		}
		else {
			s[i] = String.fromCharCode(j);
		}
	}

	return s.join('');
}

/**
 * Rotate a string by 47 characters
 *
 * @memberof Str
 * @param {string} str the string to be rotated
 * @return {string} rotated string
 */
function rot47(str) {
	const s = [];
	for (let i = 0; i < str.length; i++) {
		const j = str.charCodeAt(i);
		if ((j >= 33) && (j <= 126)) {
			s[i] = String.fromCharCode(33 + ((j + 14) % 94));
		}
		else {
			s[i] = String.fromCharCode(j);
		}
	}

	return s.join('');
}

/**
 * Parses a json string, returns null if string is invalid (instead of throwing error)
 * If the input is not a string (already parsed), returns the input itself
 *
 * @memberof Str
 * @param {any} str
 * @return {object|null}
 */
function tryParseJson(str) {
	if (str == null) return null;
	if (typeof str !== 'string') return str;

	try {
		return JSON.parse(str);
	}
	catch (e) {
		return null;
	}
}

/**
 * Stringifies an object only if it is not already a string
 * If it is already a string returns the string itself
 * If it is undefined, returns 'null'
 *
 * @memberof Str
 * @param {any} obj
 * @returns {string}
 */
function tryStringifyJson(obj) {
	if (obj == null) return 'null';
	if (typeof obj === 'string') return obj;
	return JSON.stringify(obj);
}

/**
 * Strip html tags from a string
 * @memberof Str
 * @param {string} str the string to remove tags from
 * @param {object} options object containing:
 * 	allowed: array of allowed tags eg. ['p', 'b', 'span'], default: []
 * 	blocked: array of blocked tags eg. ['p'], default: []
 * 	replaceWith: replace the removed tags with this string, default: ''
 *
 * if allowed is not given and blocked is given
 * then by default all tags not mentioned in blocked are allowed
 *
 * @return {string} resulting string by removing all tags mentioned
 */
function stripTags(str, options = {}) {
	if (!str) return '';

	const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
	const commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

	const replaceWith = options.replaceWith || '';
	const allowed = options.allowed;
	const blocked = options.blocked;

	const replaceTags = function ($0, $1) {
		if (blocked) {
			// tag is blocked
			if (blocked.includes($1.toLowerCase())) return replaceWith;
			// allowed is not given and blocked is, that means all tags are allowed
			if (!allowed) return $0;
		}
		// tag is allowed
		if (allowed && allowed.includes($1.toLowerCase())) return $0;
		// by default all tags are blocked
		return replaceWith;
	};

	let after = String(str);
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const before = after;
		after = before
			.replace(commentsAndPhpTags, replaceWith)
			.replace(tags, replaceTags);

		// return once no more tags are removed
		if (before === after) {
			return after;
		}
	}
}

/**
 * Escape a string for including in regular expressions
 * @memberof Str
 * @param {string} str string to escape
 * @return {string} escaped string
 */
function escapeRegex(str) {
	if (!str) return '';
	return String(str).replace(/[-[\]{}()*+!<=:?./\\^$|#,]/g, '\\$&');
}

/**
 * replace special characters within a string
 * NOTE: it replaces multiple special characters with single replaceWith character
 * @param {string} str
 * @param {string} replaceWith
 * @returns {string}
 */
function replaceSpecialChars(str, replaceWith = '') {
	const result = str.replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/\s]+/g, replaceWith);
	if (replaceWith) {
		return _.trim(result, replaceWith);
	}
	return result;
}

export default {
	invertCase,
	isVowel,
	isConsonant,
	plural,
	pluralize,
	transform,
	trimToNext,
	numberFormat,
	numberToWords,
	spaceClean,
	rot13,
	rot47,
	tryParseJson,
	tryStringifyJson,
	stripTags,
	escapeRegex,
	replaceSpecialChars,
};
