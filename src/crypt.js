var crypto = require('crypto');
var baseConvert = require('./base_convert');

var chars = {};
chars.NUMERIC = '0123456789';
chars.LOWER = 'abcdefghijklmnopqrstuvwxyz';
chars.UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
chars.SYMBOLS = '!#$%&()*+,-./:;<=>?@[]^_`{|}~';   // missing ', ", space, \ (as these might cause problems when copying strings)
chars.HEX = chars.NUMERIC + 'abcdef';
chars.BASE_36 = chars.NUMERIC + chars.LOWER;
chars.ALPHA = chars.LOWER + chars.UPPER;
chars.ALPHA_NUMERIC = chars.NUMERIC + chars.ALPHA;
chars.BASE_64 = chars.ALPHA_NUMERIC + '+/';
chars.PRINTABLE = chars.ALPHA_NUMERIC + chars.SYMBOLS;

/**
 * Count the minimum number of bits to represent the provided number
 *
 * This is basically floor(log($number, 2))
 * But avoids float precision issues
 *
 * @param int $number The number to count
 *
 * @return int The number of bits
 */
function countBits(number) {
	var log2 = 0;
	while(number >>= 1) {
		log2++;
	}
	return log2;
}

/**
 * generate a random string based
 * It can be treated as a Random UUID
 * 
 * you can give length and charset in options
 * if options is an integer it will treated as length
 * by default, length is 20 and charset is ALPHA_NUMERIC
 *
 * @param object|int options
 * @return string random string
 */
function randomString(options) {
	var length;
	var charset;
	var result = '';

	if(options === 0) {
		return '';
	}

	if(typeof options === 'object') {
		length = options.length || 20;
		charset = options.charset || chars.ALPHA_NUMERIC;
	}
	else if(typeof options === 'number') {
		length = options;
		charset = chars.ALPHA_NUMERIC;
	}
	else {
		length = 20;
		charset = chars.ALPHA_NUMERIC;
	}

	// determine mask for valid characters
	var mask   = 256 - (256 % charset.length);

	// Generate the string
	while (result.length < length) {
		// determine number of bytes to generate
		var bytes = (length - result.length) * Math.ceil(countBits(charset.length) / 8);

		var random_buffer;
		try {
			random_buffer = crypto.randomBytes(bytes);
		}
		catch (e) {
			continue;
		}

		for (var i = 0; i < random_buffer.length; i++) {
			if(random_buffer[i] > mask) continue;
			result += charset[random_buffer[i] % charset.length];
		}
	}

	return result;
}

/**
 * get nanoseconds in base62 format (return 7 (or 8 if lowercase) chars long string)
*/
function nanoSecondsAlpha(base36 = false) {
	var hr_time = process.hrtime();

	// largest base62 7 chars string is 3521_614_606_207
	// largest base36 8 chars string is 2821_109_907_455
	// last 9 digits are for nanoseconds
	// hence take mod 3521 from seconds so that overall string length = 7
	if(base36) {
		var seconds = String(hr_time[0] % 2821) + ("000000000" + String(hr_time[1])).slice(-9);
		return ("00000000" + baseConvert(seconds, 10, 36)).slice(-8);
	}

	var seconds = String(hr_time[0] % 3521) + ("000000000" + String(hr_time[1])).slice(-9);
	return ("0000000" + baseConvert(seconds, 10, 62)).slice(-7);
}

/**
 * generate a sequential id based on current time in millisecond and some randomness
 * It can be treated as a Sequential UUID
 * Ideal for use as a DB primary key
 *
 * @param int length
 * @return string id
 */
function sequentialID(options) {
	var current_time, random_string;
	var length = 20;
	var base36 = false;

	if(options === 0) {
		return '';
	}

	if(typeof options === 'object') {
		length = options.length || 20;
		base36 = options.base36 || false;
	}
	else if(typeof options === 'number') {
		length = options;
	}

	if(base36) {
		// convert current time in milliseconds to base36
		var current_time = baseConvert(Date.now(), 10, 36);
	}
	else {
		// convert current time in milliseconds to base62
		current_time = baseConvert(Date.now(), 10, 62);
	}

	var result = current_time + nanoSecondsAlpha(base36);
	if(length < result.length) {
		return result.substring(0, length);
	}

	if(base36) {
		random_string = randomString({length: length - result.length, charset: chars.BASE_36});
	}
	else {
		random_string = randomString(length - result.length);
	}

	return result + random_string;
}

/**
 * add dashes to a hex string to make it like v4 UUID
 * v4 UUID = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx 
 * where x is any hexadecimal digit and y is one of 8, 9, a, or b
 * eg. f47ac10b-58cc-4372-a567-0e02b2c3d479
*/
function addDashesForUUID(str) {
	return str.substring(0, 8) + '-' +
		str.substring(8, 12) + '-' +
		'4' +
		str.substring(12, 15) + '-' +
		'a' +
		str.substring(15, 18) + '-' +
		str.substring(18, 30);
}

/**
 * get sequential ID in v4 UUID format
*/
function sequentialUUID() {
	return addDashesForUUID(baseConvert(sequentialID(21), 62, 16));
}

/**
 * get random ID in v4 UUID format
*/
function randomUUID() {
	return addDashesForUUID(randomString({length: 30, charset: chars.HEX}));
}

module.exports = {
	baseConvert,
	chars,
	randomString,
	randomID: randomString,
	randomId: randomString,
	sequentialID,
	sequentialId: sequentialID,
	sequentialUUID,
	randomUUID,
	UUID: randomUUID,
};
