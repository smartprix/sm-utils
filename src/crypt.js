const crypto = require('crypto');
const _ = require('lodash');
require('./lodash_utils');
const baseConvert = require('./base_convert');

const chars = {};
chars.NUMERIC = '0123456789';
chars.LOWER = 'abcdefghijklmnopqrstuvwxyz';
chars.UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// missing ', ", space, \ (as these might cause problems when copying strings)
chars.SYMBOLS = '-_!#$%&()*+,./:;<=>?@[]^`{|}~';
chars.HEX = chars.NUMERIC + 'abcdef';
chars.BASE_36 = chars.NUMERIC + chars.LOWER;
chars.ALPHA = chars.LOWER + chars.UPPER;
chars.ALPHA_NUMERIC = chars.NUMERIC + chars.ALPHA;
chars.BASE_62 = chars.ALPHA_NUMERIC;
chars.BASE_64 = chars.ALPHA_NUMERIC + '-_';
chars.PRINTABLE = chars.ALPHA_NUMERIC + chars.SYMBOLS;

// private data for this module
const data = {};

/**
 * Count the minimum number of bits to represent the provided number
 *
 * This is basically floor(log($number, 2))
 * But avoids float precision issues
 *
 * @param number
 * @return int The number of bits
 */
function countBits(number) {
	let log2 = 0;
	while ((number >>= 1)) {
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
 * @return {string} id
 * @param {int|object} options length of the id or object of {length: int, base36: bool}
 */
function randomString(options) {
	let length;
	let charset;
	let result = '';

	if (options === 0) {
		return '';
	}

	if (typeof options === 'object') {
		length = options.length || 20;
		charset = options.charset || chars.ALPHA_NUMERIC;
	}
	else if (typeof options === 'number') {
		length = options;
		charset = chars.ALPHA_NUMERIC;
	}
	else {
		length = 20;
		charset = chars.ALPHA_NUMERIC;
	}

	// determine mask for valid characters
	const mask = 256 - (256 % charset.length);

	// Generate the string
	while (result.length < length) {
		// determine number of bytes to generate
		const bytes = (length - result.length) * Math.ceil(countBits(charset.length) / 8);

		let randomBuffer;
		try {
			randomBuffer = crypto.randomBytes(bytes);
		}
		catch (e) {
			continue;
		}

		for (let i = 0; i < randomBuffer.length; i++) {
			if (randomBuffer[i] > mask) continue;
			result += charset[randomBuffer[i] % charset.length];
		}
	}

	return result;
}

/**
 * get nanoseconds in base62 format (return 7 (or 8 if lowercase) chars long string)
*/
function nanoSecondsAlpha(base36 = false) {
	const hrtime = process.hrtime();

	// largest base62 7 chars string is 3521_614_606_207
	// largest base36 8 chars string is 2821_109_907_455
	// last 9 digits are for nanoseconds
	// hence take mod 3521 from seconds so that overall string length = 7
	if (base36) {
		const seconds = String(hrtime[0] % 2821) + ('000000000' + String(hrtime[1])).slice(-9);
		return ('00000000' + baseConvert(seconds, 10, 36)).slice(-8);
	}

	const seconds = String(hrtime[0] % 3521) + ('000000000' + String(hrtime[1])).slice(-9);
	return ('0000000' + baseConvert(seconds, 10, 62)).slice(-7);
}

/**
 * get sequential number that resets every millisecond
 * multiple call within the same millisecond will return 1, 2, 3 so on..
 * the counter will reset on next millisecond
*/
function msCounter(currentTime) {
	currentTime = currentTime || Date.now();
	if (currentTime !== data.currentMillis) {
		data.currentMillis = currentTime;
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
 * @return {string} id
 * @param {int|object} options length of the id or object of {length: int, base36: bool}
 */
function sequentialID(options) {
	let length = 20;
	let base36 = false;

	if (options === 0) {
		return '';
	}

	if (typeof options === 'object') {
		length = options.length || length;
		base36 = options.base36 || options.lowercase || base36;
	}
	else if (typeof options === 'number') {
		length = options;
	}

	const currentTime = Date.now();
	const counter = msCounter(currentTime);
	let result;

	if (base36) {
		// convert current time in milliseconds to base36
		// This will always return 8 characters till 2058
		result = baseConvert(currentTime, 10, 36);
		result += _.padStart(baseConvert(counter, 10, 36), 4, '0');
	}
	else {
		// convert current time in milliseconds to base62
		// This will always return 7 characters till 2080
		result = baseConvert(currentTime, 10, 62);
		result += _.padStart(baseConvert(counter, 10, 62), 3, '0');
	}

	if (length < result.length) {
		return result.substring(0, length);
	}

	let randomStr;
	if (base36) {
		randomStr = randomString({length: length - result.length, charset: chars.BASE_36});
	}
	else {
		randomStr = randomString(length - result.length);
	}

	return result + randomStr;
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

/**
 * Encode the string/buffer using a given encoding
*/
function baseEncode(string, opts) {
	if (_.isString(opts)) {
		opts = {
			toEncoding: opts,
			fromEncoding: 'binary',
		};
	}

	let fromEncoding = opts.fromEncoding || 'binary';
	let toEncoding = opts.toEncoding || 'base64url';

	if (fromEncoding === 'base64url') fromEncoding = 'base64';

	const buffer = (string instanceof Buffer) ? string : Buffer.from(string, fromEncoding);

	toEncoding = toEncoding.toLowerCase();

	if (toEncoding === 'buffer') {
		return buffer;
	}

	if (['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'].indexOf(toEncoding) > -1) {
		return buffer.toString(toEncoding);
	}

	if (toEncoding === 'base64url') {
		return buffer.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	}

	return string;
}

function baseDecode(string, opts) {
	if (_.isString(opts)) {
		opts = {
			fromEncoding: opts,
			toEncoding: 'binary',
		};
	}

	return baseEncode(string, opts);
}

function baseDecodeToBuffer(string, fromEncoding) {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'buffer',
	});
}

/**
 * Compute hash of a string using given algorithm
 * encoding can be 'hex', 'binary', 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
*/
function hash(algo, string, {encoding = 'hex'} = {}) {
	const hashed = crypto.createHash(algo).update(string);

	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return hashed.digest(encoding);
	}

	return baseEncode(hashed.digest(), encoding);
}

function md5(string, {encoding = 'hex'} = {}) {
	return hash('md5', string, {encoding});
}

function sha1(string, {encoding = 'hex'} = {}) {
	return hash('sha1', string, {encoding});
}

function sha256(string, {encoding = 'hex'} = {}) {
	return hash('sha256', string, {encoding});
}

function sha384(string, {encoding = 'hex'} = {}) {
	return hash('sha384', string, {encoding});
}

function sha512(string, {encoding = 'hex'} = {}) {
	return hash('sha512', string, {encoding});
}

/**
 * Create cryptographic HMAC digests
*/
function hmac(algo, string, key, {encoding = 'hex'} = {}) {
	const hashed = crypto.createHmac(algo, key).update(string);

	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return hashed.digest(encoding);
	}

	return baseEncode(hashed.digest(), encoding);
}

function sha1Hmac(string, key, {encoding = 'hex'} = {}) {
	return hmac('sha1', key, string, {encoding});
}

function sha256Hmac(string, key, {encoding = 'hex'} = {}) {
	return hmac('sha256', key, string, {encoding});
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling encrypt on the same string multiple times will return different encrypted strings
 * Optionally specify encoding in which you want to get the output
*/
function encrypt(string, key, {encoding = 'base64url'} = {}) {
	if (string.length < 6) {
		string = _.padEnd(string, 6, '\v');
	}

	if (key.length !== 32) {
		key = sha256(key, {encoding: 'buffer'});
	}

	const iv = crypto.randomBytes(16);

	const cipher = crypto.createCipheriv('AES-256-CFB', key, iv);
	const crypted = Buffer.concat([iv, cipher.update(string), cipher.final()]);
	return '1' + baseEncode(crypted, encoding);
}

/**
 * Decrypt the given string with the given key encrypted using encrypt
*/
function decrypt(string, key, {encoding = 'base64url'} = {}) {
	if (key.length !== 32) {
		key = sha256(key, {encoding: 'buffer'});
	}

	const version = string.substring(0, 1);  // eslint-disable-line
	const decoded = baseDecodeToBuffer(string.substring(1), encoding);

	const decipher = crypto.createDecipheriv('AES-256-CFB', key, decoded.slice(0, 16));
	const decrypted = Buffer.concat([decipher.update(decoded.slice(16)), decipher.final()]);
	return _.trimEnd(decrypted, '\v');
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling EncryptStatic on the same string multiple times will return same encrypted strings
 * this encryption is weaker than Encrypt but has the benefit of returing same encypted string
 * for same string and key.
*/
function encryptStatic(string, key, {encoding = 'base64url'} = {}) {
	if (string.length < 6) {
		string = _.padEnd(string, 6, '\v');
	}

	const cipher = crypto.createCipher('AES-256-CFB', key);
	const crypted = Buffer.concat([cipher.update(string), cipher.final()]);
	return '1' + baseEncode(crypted, encoding);
}

/**
 * Decrypt the given string with the given key encrypted using encryptStatic
*/
function decryptStatic(string, key, {encoding = 'base64url'} = {}) {
	const version = string.substring(0, 1);  // eslint-disable-line
	const decoded = baseDecodeToBuffer(string.substring(1), encoding);

	const decipher = crypto.createDecipher('AES-256-CFB', key);
	const decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
	return _.trimEnd(decrypted, '\v');
}

/**
 * Hash a given password using cryptographically strong hash function
 * Returns a 50 character long hash
*/
function hashPassword(password, opts = {}) {
	const salt = opts.salt || crypto.randomBytes(12);

	const hashed = crypto.pbkdf2Sync(password, salt, 1000, 25, 'sha256');
	const passHash = '1' + baseEncode(Buffer.concat([salt, hashed]), 'base64url');

	return passHash.substring(0, 50);
}

/**
 * Verify that given password and hashed password are same or not
*/
function verifyPassword(password, hashed) {
	const version = hashed.substring(0, 1);  // eslint-disable-line
	const salt = baseDecodeToBuffer(hashed.substring(1), 'base64url').slice(0, 12);

	if (hashed === hashPassword(password, {salt})) return true;
	if (hashed === hashPassword(password.trim(), {salt})) return true;
	if (hashed === hashPassword(_.upperFirst(password), {salt})) return true;
	if (hashed === hashPassword(_.invertCase(password), {salt})) return true;

	return false;
}

/**
 * Base64 Encode
*/
function base64Encode(string, fromEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'base64',
	});
}

/**
 * URL Safe Base64 Encode
*/
function base64UrlEncode(string, fromEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'base64url',
	});
}

/**
 * Base64 Decode
*/
function base64Decode(string, toEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding: 'base64',
		toEncoding,
	});
}

/**
 * URL Safe Base64 Decode
*/
function base64UrlDecode(string, toEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding: 'base64url',
		toEncoding,
	});
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
	uuid: randomUUID,

	nanoSecondsAlpha,

	hash,
	md5,
	sha1,
	sha256,
	sha384,
	sha512,

	hmac,
	sha1Hmac,
	sha256Hmac,

	encrypt,
	decrypt,
	encryptStatic,
	decryptStatic,

	hashPassword,
	verifyPassword,

	baseEncode,
	baseDecode,
	baseDecodeToBuffer,
	base64Encode,
	base64UrlEncode,
	base64Decode,
	base64UrlDecode,
};
