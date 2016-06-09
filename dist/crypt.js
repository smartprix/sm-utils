'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var crypto = require('crypto');
var _ = require('lodash');
require('./lodash_utils');
var baseConvert = require('./base_convert');

var chars = {};
chars.NUMERIC = '0123456789';
chars.LOWER = 'abcdefghijklmnopqrstuvwxyz';
chars.UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
chars.SYMBOLS = '-_!#$%&()*+,./:;<=>?@[]^`{|}~'; // missing ', ", space, \ (as these might cause problems when copying strings)
chars.HEX = chars.NUMERIC + 'abcdef';
chars.BASE_36 = chars.NUMERIC + chars.LOWER;
chars.ALPHA = chars.LOWER + chars.UPPER;
chars.ALPHA_NUMERIC = chars.NUMERIC + chars.ALPHA;
chars.BASE_62 = chars.ALPHA_NUMERIC;
chars.BASE_64 = chars.ALPHA_NUMERIC + '-_';
chars.PRINTABLE = chars.ALPHA_NUMERIC + chars.SYMBOLS;

// private data for this module
var data = {};

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
	while (number >>= 1) {
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

	if (options === 0) {
		return '';
	}

	if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
		length = options.length || 20;
		charset = options.charset || chars.ALPHA_NUMERIC;
	} else if (typeof options === 'number') {
		length = options;
		charset = chars.ALPHA_NUMERIC;
	} else {
		length = 20;
		charset = chars.ALPHA_NUMERIC;
	}

	// determine mask for valid characters
	var mask = 256 - 256 % charset.length;

	// Generate the string
	while (result.length < length) {
		// determine number of bytes to generate
		var bytes = (length - result.length) * Math.ceil(countBits(charset.length) / 8);

		var random_buffer;
		try {
			random_buffer = crypto.randomBytes(bytes);
		} catch (e) {
			continue;
		}

		for (var i = 0; i < random_buffer.length; i++) {
			if (random_buffer[i] > mask) continue;
			result += charset[random_buffer[i] % charset.length];
		}
	}

	return result;
}

/**
 * get nanoseconds in base62 format (return 7 (or 8 if lowercase) chars long string)
*/
function nanoSecondsAlpha() {
	var base36 = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

	var hr_time = process.hrtime();

	// largest base62 7 chars string is 3521_614_606_207
	// largest base36 8 chars string is 2821_109_907_455
	// last 9 digits are for nanoseconds
	// hence take mod 3521 from seconds so that overall string length = 7
	if (base36) {
		var seconds = String(hr_time[0] % 2821) + ("000000000" + String(hr_time[1])).slice(-9);
		return ("00000000" + baseConvert(seconds, 10, 36)).slice(-8);
	}

	var seconds = String(hr_time[0] % 3521) + ("000000000" + String(hr_time[1])).slice(-9);
	return ("0000000" + baseConvert(seconds, 10, 62)).slice(-7);
}

/**
 * get sequential number that resets every millisecond
 * multiple call within the same millisecond will return 1, 2, 3 so on..
 * the counter will reset on next millisecond
*/
function msCounter(current_time) {
	current_time = current_time || Date.now();
	if (current_time != data.current_millis) {
		data.current_millis = current_time;
		data.counter = 0;
	}

	data.counter = (data.counter || 0) + 1;
	return data.counter;
}

/**
 * generate a sequential id based on current time in millisecond and some randomness
 * It can be treated as a Sequential UUID
 * Ideal for use as a DB primary key
 * For best results use atleast 15 characters in base62 and 18 characters in base36 encoding
 *
 * @param int length
 * @return string id
 */
function sequentialID(options) {
	var length = 20;
	var base36 = false;

	if (options === 0) {
		return '';
	}

	if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
		length = options.length || length;
		base36 = options.base36 || options.lowercase || base36;
	} else if (typeof options === 'number') {
		length = options;
	}

	var current_time = Date.now();
	var counter = msCounter(current_time);
	var result;

	if (base36) {
		// convert current time in milliseconds to base36
		// This will always return 8 characters till 2058
		result = baseConvert(current_time, 10, 36);
		result += _.padStart(baseConvert(counter, 10, 36), 4, '0');
	} else {
		// convert current time in milliseconds to base62
		// This will always return 7 characters till 2080
		result = baseConvert(current_time, 10, 62);
		result += _.padStart(baseConvert(counter, 10, 62), 3, '0');
	}

	if (length < result.length) {
		return result.substring(0, length);
	}

	var random_string;

	if (base36) {
		random_string = randomString({ length: length - result.length, charset: chars.BASE_36 });
	} else {
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
	return str.substring(0, 8) + '-' + str.substring(8, 12) + '-' + '4' + str.substring(12, 15) + '-' + 'a' + str.substring(15, 18) + '-' + str.substring(18, 30);
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
	return addDashesForUUID(randomString({ length: 30, charset: chars.HEX }));
}

/**
 * Compute hash of a string using given algorithm
 * encoding can be 'hex', 'binary', 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
*/
function hash(algo, string) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'hex' : arguments[2];

	if (encoding == 'buffer') encoding = undefined;
	return crypto.createHash(algo).update(string).digest(encoding);
}

function md5(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'hex' : arguments[1];

	return hash("md5", string, encoding);
}

function sha1(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'hex' : arguments[1];

	return hash("sha1", string, encoding);
}

function sha256(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'hex' : arguments[1];

	return hash("sha256", string, encoding);
}

function sha512(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'hex' : arguments[1];

	return hash("sha512", string, encoding);
}

/**
 * Create cryptographic HMAC digests
*/
function hmac(algo, string, key) {
	var encoding = arguments.length <= 3 || arguments[3] === undefined ? 'hex' : arguments[3];

	if (encoding == 'buffer') encoding = undefined;
	return crypto.createHmac(algo, key).update(string).digest(encoding);
}

function sha1Hmac(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'hex' : arguments[2];

	return hmac("sha1", key, string, encoding);
}

function sha256Hmac(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'hex' : arguments[2];

	return hmac("sha256", key, string, encoding);
}

/**
 * Encode the string/buffer using a given encoding
*/
function baseEncode(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'base64url' : arguments[1];
	var in_encoding = arguments.length <= 2 || arguments[2] === undefined ? 'binary' : arguments[2];

	var buffer = string instanceof Buffer ? string : Buffer.from(string, in_encoding);

	encoding = encoding.toLowerCase();

	if (encoding === "buffer") {
		return buffer;
	}

	if (["ascii", "utf8", "utf16le", "ucs2", "base64", "binary", "hex"].indexOf(encoding) > -1) {
		return buffer.toString(encoding);
	}

	if (encoding === 'base64url') {
		return buffer.toString("base64").replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	return string;
}

/**
 * Decode the string encoded using a given encoding
 * You can give out_encoding to en
*/
function baseDecode(string) {
	var encoding = arguments.length <= 1 || arguments[1] === undefined ? 'base64url' : arguments[1];
	var out_encoding = arguments.length <= 2 || arguments[2] === undefined ? 'binary' : arguments[2];

	encoding = encoding.toLowerCase();

	if (encoding === "buffer") {
		return Buffer.from(string);
	}

	if (["ascii", "utf8", "utf16le", "ucs2", "base64", "binary", "hex"].indexOf(encoding) > -1) {
		return baseEncode(Buffer.from(string, encoding), out_encoding);
	}

	if (encoding === 'base64url') {
		return baseEncode(Buffer.from(string, "base64"), out_encoding);
	}

	return string;
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling encrypt on the same string multiple times will return different encrypted strings
 * Optionally specify encoding in which you want to get the output
*/
function encrypt(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'base64url' : arguments[2];

	if (string.length < 6) {
		string = _.padEnd(string, 6, "\v");
	}

	if (key.length != 32) {
		key = sha256(key, 'buffer');
	}

	var iv = crypto.randomBytes(16);

	var cipher = crypto.createCipheriv('AES-256-CFB', key, iv);
	var crypted = Buffer.concat([iv, cipher.update(string), cipher.final()]);
	return '1' + baseEncode(crypted, encoding);
}

/**
 * Decrypt the given string with the given key encrypted using encrypt
*/
function decrypt(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'base64url' : arguments[2];

	if (key.length != 32) {
		key = sha256(key, 'buffer');
	}

	var version = string.substring(0, 1);
	var decoded = baseDecode(string.substring(1), encoding, "buffer");

	var decipher = crypto.createDecipheriv('AES-256-CFB', key, decoded.slice(0, 16));
	var decrypted = Buffer.concat([decipher.update(decoded.slice(16)), decipher.final()]);
	return _.trimEnd(decrypted, "\v");
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling EncryptStatic on the same string multiple times will return same encrypted strings
 * this encryption is weaker than Encrypt but has the benefit of returing same encypted string
 * for same string and key.
*/
function encryptStatic(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'base64url' : arguments[2];

	if (string.length < 6) {
		string = _.padEnd(string, 6, "\v");
	}

	var cipher = crypto.createCipher('AES-256-CFB', key);
	var crypted = Buffer.concat([cipher.update(string), cipher.final()]);
	return '1' + baseEncode(crypted, encoding);
}

/**
 * Decrypt the given string with the given key encrypted using encryptStatic
*/
function decryptStatic(string, key) {
	var encoding = arguments.length <= 2 || arguments[2] === undefined ? 'base64url' : arguments[2];

	var version = string.substring(0, 1);
	var decoded = baseDecode(string.substring(1), encoding, "buffer");

	var decipher = crypto.createDecipher('AES-256-CFB', key);
	var decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
	return _.trimEnd(decrypted, "\v");
}

/**
 * Hash a given password using cryptographically strong hash function
 * Returns a 50 character long hash
*/
function hashPassword(password, salt) {
	if (salt === undefined) {
		salt = crypto.randomBytes(12);
	}

	var hash = crypto.pbkdf2Sync(password, salt, 1000, 25, 'sha256');
	var pass_hash = '1' + baseEncode(Buffer.concat([salt, hash]), 'base64url');

	return pass_hash.substring(0, 50);
}

/**
 * Verify that given password and hashed password are same or not
*/
function verifyPassword(password, hashed) {
	var version = hashed.substring(0, 1);
	var salt = baseDecode(hashed.substring(1), 'base64url', 'buffer').slice(0, 12);

	if (hashed === hashPassword(password, salt)) return true;
	if (hashed === hashPassword(password.trim(), salt)) return true;
	if (hashed === hashPassword(_.upperFirst(password), salt)) return true;
	if (hashed === hashPassword(_.invertCase(password), salt)) return true;
}

/**
 * Base64 Encode
*/
function base64Encode(string) {
	return baseEncode(string, "base64");
}

/**
 * URL Safe Base64 Encode
*/
function base64UrlEncode(string) {
	return baseEncode(string, "base64url");
}

/**
 * Base64 Decode
*/
function base64Decode(string) {
	return baseDecode(string, 'base64');
}

/**
 * URL Safe Base64 Decode
*/
function base64UrlDecode(string) {
	return baseDecode(string, 'base64url');
}

module.exports = {
	baseConvert: baseConvert,
	chars: chars,
	randomString: randomString,
	randomID: randomString,
	randomId: randomString,
	sequentialID: sequentialID,
	sequentialId: sequentialID,
	sequentialUUID: sequentialUUID,
	randomUUID: randomUUID,
	UUID: randomUUID,
	hash: hash, md5: md5, sha1: sha1, sha256: sha256, sha512: sha512,
	hmac: hmac, sha1Hmac: sha1Hmac, sha256Hmac: sha256Hmac,
	encrypt: encrypt, decrypt: decrypt,
	encryptStatic: encryptStatic, decryptStatic: decryptStatic,
	hashPassword: hashPassword, verifyPassword: verifyPassword,
	baseEncode: baseEncode, baseDecode: baseDecode,
	base64Encode: base64Encode, base64UrlEncode: base64UrlEncode,
	base64Decode: base64Decode, base64UrlDecode: base64UrlDecode
};