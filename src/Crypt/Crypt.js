import crypto from 'crypto';
import zlib from 'zlib';
import {promisify} from 'util';
import _ from 'lodash';

import baseConvert from './base_convert';
import Str from '../Str';

const gzinflate = promisify(zlib.inflateRaw);
const gzdeflate = promisify(zlib.deflateRaw);

/**
 * Cryptographic utilities
 * @namespace Crypt
 */

/**
 * different charsets available
 * @memberof Crypt
 * @type {object}
 */
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
 * Return a random number between 0 and 1
 * @memberof Crypt
 * @return {number} A random number (float) between 0 and 1
 */
function random() {
	return Math.random();
}

/**
 * Return a random integer between min and max (both inclusive)
 *
 * @memberof Crypt
 * @param {number} num If max is not passed, num is max and min is 0
 * @param {number} [max] max value of int, num will be min
 * @return {number} A random integer between min and max
*/
function randomInt(num, max) {
	if (max === undefined) {
		max = num;
		num = 0;
	}
	return Math.floor((Math.random() * ((max - num) + 1)) + num);
}

/**
 * Count the minimum number of bits to represent the provided number
 *
 * This is basically floor(log($number, 2))
 * But avoids float precision issues
 *
 * @param number
 * @return {number} The number of bits
 * @ignore
 */
function countBits(number) {
	let log2 = 0;
	while ((number >>= 1)) {
		log2++;
	}
	return log2;
}

/**
 * @typedef {object} randomOpts
 * @property {number} length integer
 * @property {boolean} base36 if true will use BASE_36 charset
 * @property {string} charset provide a charset string
 */

/**
 * Generate a random string based on the options passed.
 * It can be treated as a Random UUID.
 *
 * You can give length and charset in options.
 * If options is an integer it will treated as length.
 * By default, length is 20 and charset is ALPHA_NUMERIC
 *
 * @memberof Crypt
 * @param  {number | (randomOpts & {randomBytesFunc?: (size: number) => Buffer})} options
 * length of the id or options object
 * @return {string} id
 */
function randomString(options = {}) {
	let length;
	let charset;
	let result = '';

	if (options === 0) {
		return '';
	}

	if (typeof options === 'object') {
		length = options.length || 20;
		if (options.base36) {
			charset = chars.BASE_36;
		}
		else {
			charset = options.charset || chars.ALPHA_NUMERIC;
		}
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

	let randomFunc;
	if (options.randomBytesFunc) {
		randomFunc = options.randomBytesFunc;
	}
	else {
		randomFunc = crypto.randomBytes.bind(crypto);
	}

	// Generate the string
	while (result.length < length) {
		// determine number of bytes to generate
		const bytes = (length - result.length) * Math.ceil(countBits(charset.length) / 8);

		let randomBuffer;
		try {
			randomBuffer = randomFunc(bytes);
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
 * Shuffle an array or a string.
 *
 * @memberof Crypt
 * @template T
 * @param {Array<T> | string} itemToShuffle item which you want to shuffle
 * @param {object} [options = {}] object of {seed: number}
 * @param {() => number} options.randomFunc Use this random function instead of default
 * @param {number} options.seed optionally give a seed to do a constant shuffle
 * @return {Array<T> | string} shuffled item
 */
function shuffle(itemToShuffle, options = {}) {
	let array;
	if (typeof itemToShuffle === 'string') {
		array = itemToShuffle.split();
	}
	else {
		array = itemToShuffle.slice();
	}

	if (!Array.isArray(array)) {
		throw new Error('Array expected');
	}

	let randomFunc;
	if (options.randomFunc) {
		randomFunc = options.randomFunc;
	}
	else if (options.seed) {
		let seed = options.seed;
		randomFunc = function () {
			const x = Math.sin(seed++) * 10000;
			return x - Math.floor(x);
		};
	}
	else {
		randomFunc = Math.random;
	}

	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(randomFunc() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}

	if (typeof itemToShuffle === 'string') {
		return array.join();
	}

	return array;
}

/**
 * @typedef {object} randomFunctions
 * @property {number} seed
 * @property {number} index
 * @property {() => number)} random number b/w 0 and 1
 * @property {(num: number, max?: number) => } int integer less than num or b/w num and max
 * @property {(size: number) => Buffer} bytes
 * @property {(options: number|randomOpts) => string} string
 * @property {(items: any[] | string) => any[] | string} shuffle
 */

/**
 *
 * @memberof Crypt
 * @param {number} seed integer
 * @return {randomFunctions} Object of all random functions
 */
function seededRandom(seed) {
	return {
		seed,
		index: 0,

		random() {
			const x = Math.sin(seed + this.index++) * 10000;
			return x - Math.floor(x);
		},

		int(num, max = undefined) {
			if (max === undefined) {
				max = num;
				num = 0;
			}
			return Math.floor((this.random() * ((max - num) + 1)) + num);
		},

		bytes(numBytes) {
			const result = [];
			while (numBytes--) {
				result.push(this.int(0, 255));
			}
			return Buffer.from(result);
		},

		string(options = {}) {
			options.randomBytesFunc = this.bytes.bind(this);
			return randomString(options);
		},

		shuffle(itemToShuffle) {
			const randomFunc = this.random.bind(this);
			return shuffle(itemToShuffle, {randomFunc});
		},
	};
}

/**
 * Get nanoseconds in base62 or base36 format.
 *
 * @memberof Crypt
 * @param {boolean} base36 use base36 format or not
 * @return {string} nanoseconds
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
 * Get sequential number that resets every millisecond.
 *
 * NOTE: Multiple call within the same millisecond will return 1, 2, 3 so on..
 * The counter will reset on next millisecond
 *
 * @param  {number} currentTime
 * @return {number} sequential number
 * @ignore
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
 * Generate a sequential id based on current time in millisecond and some randomness.
 * It can be treated as a Sequential UUID. Ideal for use as a DB primary key.
 *
 * NOTE: For best results use atleast 15 characters in base62 and 18 characters in base36 encoding
 *
 * @memberof Crypt
 * @param {number|object} options length of the id or object of {length: int, base36: bool}
 * @return {string} id
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
 * Add dashes to a hex string to make it like v4 UUID.
 * v4 UUID = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, a, or b
 * eg. f47ac10b-58cc-4372-a567-0e02b2c3d479
 *
 * @param  {string} str the hex string
 * @return {string} the modified string
 * @private
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
 * Get sequential ID in v4 UUID format.
 * @memberof Crypt
 */
function sequentialUUID() {
	return addDashesForUUID(baseConvert(sequentialID(21), 62, 16));
}

/**
 * Get random ID in v4 UUID format.
 * @memberof Crypt
 */
function randomUUID() {
	return addDashesForUUID(randomString({length: 30, charset: chars.HEX}));
}

/**
 * Supported Encodings:
 *   'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url',
 *   'utf8', 'buffer', 'utf16le' ('ucs2')
 * @typedef {object} encodingConversion
 * @property {string} [toEncoding='base64url'] default 'base64url'
 * @property {string} [fromEncoding='binary'] default 'binary'
 */

/**
 * Encode the string/buffer using a given encoding.
 * Supported Encodings:
 *   'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url',
 *   'utf8', 'buffer', 'utf16le' ('ucs2')
 *
 * @memberof Crypt
 * @param  {string|Buffer} string item to be encoded
 * @param  {encodingConversion|string} opts   object or string specifying the encoding(s)
 * @return {string|Buffer}        encoded item
 *
 * NOTE: If opts is a string, it is considered as the toEncoding.
 * The fromEncoding defaults to binary, while the toEncoding defaults to base64url.
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


/**
 * Decode a string encoded using a given encoding.
 *
 * @memberof Crypt
 * @param  {string|Buffer} string item to be decoded
 * @param  {encodingConversion|string} opts   object or string specifying the encoding(s)
 * @return {string}        decoded item
 *
 * NOTE: If opts is a string, it is considered as the fromEncoding
 * (i.e that was used to encode the string).
 */
function baseDecode(string, opts) {
	if (_.isString(opts)) {
		opts = {
			fromEncoding: opts,
			toEncoding: 'binary',
		};
	}

	return baseEncode(string, opts);
}

/**
 * Decode a string encoded using a given encoding to a buffer.
 *
 * @memberof Crypt
 * @param  {string|Buffer} string item to be decoded
 * @param  {string} fromEncoding  encoding used to encode the string
 * @return {Buffer}        decoded item
 */
function baseDecodeToBuffer(string, fromEncoding) {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'buffer',
	});
}


/**
 * Supported Encodings:
 * 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
 * @typedef {object} encodingOpts
 * @property {string} [encoding='hex'] default 'hex'
 */


/**
 * Compute hash of a string using given algorithm
 * encoding can be 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
 *
 * @memberof Crypt
 * @param {string} algo                      algo to be used for hashing
 * @param {string} string                    string to be hashed
 * @param {encodingOpts} [opts={}]
 * @return {string}                           encoded hash value
 */
function hash(algo, string, {encoding = 'hex'} = {}) {
	const hashed = crypto.createHash(algo).update(string);

	if (encoding === 'binary') encoding = 'latin1';
	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return hashed.digest(encoding);
	}

	return baseEncode(hashed.digest(), encoding);
}

/**
 * Compute hash of a string using md5
 *
 * @memberof Crypt
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded hash value
 */
function md5(string, {encoding = 'hex'} = {}) {
	return hash('md5', string, {encoding});
}

/**
 * Compute hash of a string using sha1
 *
 * @memberof Crypt
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded hash value
 */
function sha1(string, {encoding = 'hex'} = {}) {
	return hash('sha1', string, {encoding});
}

/**
 * Compute hash of a string using sha256
 *
 * @memberof Crypt
 * @param  {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded hash value
 */
function sha256(string, {encoding = 'hex'} = {}) {
	return hash('sha256', string, {encoding});
}

/**
 * Compute hash of a string using sha384
 *
 * @memberof Crypt
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded hash value
 */
function sha384(string, {encoding = 'hex'} = {}) {
	return hash('sha384', string, {encoding});
}

/**
 * Compute hash of a string using sha512
 *
 * @memberof Crypt
 * @param  {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded hash value
 */
function sha512(string, {encoding = 'hex'} = {}) {
	return hash('sha512', string, {encoding});
}

/**
 * Create cryptographic HMAC digests using given algo
 *
 * @memberof Crypt
 * @param {string} algo algo to be used for hashing
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded HMAC digest
 */
function hmac(algo, string, key, {encoding = 'hex'} = {}) {
	if (typeof key === 'string') key = Buffer.from(key, 'binary');
	const hashed = crypto.createHmac(algo, key).update(string);

	if (encoding === 'binary') encoding = 'latin1';
	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return hashed.digest(encoding);
	}

	return baseEncode(hashed.digest(), encoding);
}

/**
 * Create cryptographic HMAC digests using sha1
 *
 * @memberof Crypt
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded HMAC digest
 */
function sha1Hmac(string, key, {encoding = 'hex'} = {}) {
	return hmac('sha1', string, key, {encoding});
}

/**
 * Create cryptographic HMAC digests using sha256
 *
 * @memberof Crypt
 * @param {string} string string to be hashed
 * @param {encodingOpts} [options={}] object of {encoding}
 * @return {string} encoded HMAC digest
 */
function sha256Hmac(string, key, {encoding = 'hex'} = {}) {
	return hmac('sha256', string, key, {encoding});
}

/**
 * Sign a message using a private key.
 *
 * NOTE: Generate a key pair using:
 * ```sh
 * openssl ecparam -genkey -name secp256k1 | openssl ec -aes128 -out private.pem
 * openssl ec -in private.pem -pubout -out public.pem
 * ```
 *
 * @memberof Crypt
 * @param  {string} message           the message to be signed
 * @param  {string|object} privateKey
 * @param  {encodingOpts} opts        opts can have {encoding (default 'hex')
 * @return {string}                   signature
 *
 * NOTE: If privateKey is a string, it is treated as a raw key with no passphrase.
 * If privateKey is an object, it must contain the following property:
 *   key: <string> - PEM encoded private key (required)
 */
function sign(message, privateKey, opts = {}) {
	let encoding = opts.encoding || 'hex';
	const signed = crypto.createSign('SHA256').update(message);

	if (encoding === 'binary') encoding = 'latin1';
	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return signed.sign(privateKey, encoding);
	}

	return baseEncode(signed.sign(privateKey), encoding);
}

/**
 * Verify a message using a public key
 * opts can have {encoding (default 'hex')}
 *
 * NOTE: Generate a key pair using:
 * ```sh
 * openssl ecparam -genkey -name secp256k1 | openssl ec -aes128 -out private.pem
 * openssl ec -in private.pem -pubout -out public.pem
 * ```
 *
 * @memberof Crypt
 * @param  {string} message          message to be verified
 * @param  {string} signature
 * @param  {string|object} publicKey
 * @param  {encodingOpts} [opts={}]  opts can have {encoding (default 'hex')}
 * @return {boolean}                 true or false, depending on the validity of
 * the signature for the data and public key
 */
function verify(message, signature, publicKey, opts = {}) {
	let encoding = opts.encoding || 'hex';
	const verified = crypto.createVerify('SHA256').update(message);

	if (encoding === 'binary') encoding = 'latin1';
	if (['latin1', 'base64', 'hex'].indexOf(encoding) > -1) {
		return verified.verify(publicKey, signature, encoding);
	}

	if (encoding === 'buffer') {
		return verified.verify(publicKey, signature);
	}

	const signBuffer = baseDecodeToBuffer(signature, encoding);
	return verified.verify(publicKey, signBuffer);
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling encrypt on the same string multiple times will return different encrypted strings
 * Optionally specify encoding in which you want to get the output
 *
 * @memberof Crypt
 * @param  {string} string                          string to be encrypted
 * @param  {string} key                             key to be used
 * @param {encodingOpts} [options={}] object of {encoding} (default: 'base64url')
 * @return {string}                                 encrypted string
 */
function encrypt(string, key, {encoding = 'base64url'} = {}) {
	if (string.length < 6) {
		string = _.padEnd(string, 6, '\v');
	}

	if (key.length !== 32) {
		key = sha256(key, {encoding: 'buffer'});
	}

	const ivLength = 16;
	const iv = crypto.randomBytes(ivLength);

	const cipher = crypto.createCipheriv('AES-256-CFB', key, iv);
	const crypted = Buffer.concat([iv, cipher.update(string), cipher.final()]);
	return '1' + baseEncode(crypted, encoding);
}

/**
 * Decrypt the given string with the given key encrypted using encrypt
 *
 * @memberof Crypt
 * @param  {string} string                          string to be decrypted
 * @param  {string} key                             key to be used
 * @param {encodingOpts} [options={}] object of {encoding} (default: 'base64url')
 * @return {string}                                 decrypted string
 */
function decrypt(string, key, {encoding = 'base64url'} = {}) {
	if (key.length !== 32) {
		key = sha256(key, {encoding: 'buffer'});
	}

	const version = string.substring(0, 1);  // eslint-disable-line
	const decoded = baseDecodeToBuffer(string.substring(1), encoding);

	const ivLength = 16;
	const decipher = crypto.createDecipheriv('AES-256-CFB', key, decoded.slice(0, ivLength));
	const decrypted = Buffer.concat([decipher.update(decoded.slice(ivLength)), decipher.final()]);
	return _.trimEnd(decrypted, '\v');
}

/**
 * Encrypt the given string with the given key using AES 256
 * Calling EncryptStatic on the same string multiple times will return same encrypted strings
 * this encryption is weaker than Encrypt but has the benefit of returing same encrypted string
 * for same string and key.
 *
 * @memberof Crypt
 * @param  {string} string                          string to be encrypted
 * @param  {string} key                             key to be used
 * @param {encodingOpts} [options={}] object of {encoding} (default: 'base64url')
 * @return {string}                                 encrypted string
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
 *
 * @memberof Crypt
 * @param  {string} string                          string to be decrypted
 * @param  {string} key                             key to be used
 * @param {encodingOpts} [options={}] object of {encoding} (default: 'base64url')
 * @return {string}                                 decrypted string
 */
function decryptStatic(string, key, {encoding = 'base64url'} = {}) {
	const version = string.substring(0, 1);  // eslint-disable-line
	const decoded = baseDecodeToBuffer(string.substring(1), encoding);

	const decipher = crypto.createDecipher('AES-256-CFB', key);
	const decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
	return _.trimEnd(decrypted, '\v');
}

/**
 * Convert a message into an encrypted token by:
 * signing it with privateKey + encrypting it with publicKey
 * you only need a publicKey to verify and decrypt this token
 * @memberof Crypt
 * @param {any} message will be JSON.stringified
 * @param {string|object} privateKey
 * @param {string} publicKey
 * @return {string}
 */
function signAndEncrypt(message, privateKey, publicKey) {
	const version = '1';
	const stringified = JSON.stringify(message);
	const signature = sign(stringified, privateKey, {encoding: 'base64url'});
	const encrypted = encrypt(stringified, publicKey, {encoding: 'base64url'});
	return version + encrypted + '.' + signature;
}

/**
 * Convert an encrypted token (generated by signAndEncrypt) into a message
 * @memberof Crypt
 * @param {string} token generated by signAndEncrypt
 * @param {string} publicKey
 */
function verifyAndDecrypt(token, publicKey) {
	const [messageEncrypted, signature] = token.split('.');
	if (!messageEncrypted || !signature) {
		throw new Error('Malformed Token');
	}

	const version = messageEncrypted[0];  // eslint-disable-line
	const message = decrypt(messageEncrypted.substring(1), publicKey, {encoding: 'base64url'});
	if (!message) throw new Error('Malformed Token');

	const verified = verify(message, signature, publicKey, {encoding: 'base64url'});
	if (!verified) {
		throw new Error('Incorrect Signature');
	}

	return JSON.parse(message);
}

/**
 * Hash a given password using cryptographically strong hash function
 * @memberof Crypt
 * @param {string} password
 * @param {object} [opts={}]
 * @param {string|Buffer} opts.salt
 * @return {string} 50 character long hash
 */
function hashPassword(password, opts = {}) {
	const salt = opts.salt || crypto.randomBytes(12);

	const hashed = crypto.pbkdf2Sync(password, salt, 1000, 25, 'sha256');
	const passHash = '1' + baseEncode(Buffer.concat([salt, hashed]), 'base64url');

	return passHash.substring(0, 50);
}

/**
 * Verify that given password and hashed password are same or not
 * @memberof Crypt
 * @param {string} password
 * @param {string} hashed
 * @return {boolean}
 */
function verifyPassword(password, hashed) {
	const version = hashed.substring(0, 1);  // eslint-disable-line
	const salt = baseDecodeToBuffer(hashed.substring(1), 'base64url').slice(0, 12);

	if (hashed === hashPassword(password, {salt})) return true;
	if (hashed === hashPassword(password.trim(), {salt})) return true;
	if (hashed === hashPassword(Str.invertCase(password), {salt})) return true;

	return false;
}

/**
 * Base64 Encode
 * @memberof Crypt
 * @param {string} string
 * @param {string} [fromEncoding='binary']
 */
function base64Encode(string, fromEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'base64',
	});
}

/**
 * URL Safe Base64 Encode
 * @memberof Crypt
 * @param {string} string
 * @param {string} [fromEncoding='binary']
 */
function base64UrlEncode(string, fromEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding,
		toEncoding: 'base64url',
	});
}

/**
 * Base64 Decode
 * @memberof Crypt
 * @param {string} string
 * @param {string} [toEncoding='binary']
 */
function base64Decode(string, toEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding: 'base64',
		toEncoding,
	});
}

/**
 * URL Safe Base64 Decode
 * @memberof Crypt
 * @param {string} string
 * @param {string} [toEncoding='binary']
 */
function base64UrlDecode(string, toEncoding = 'binary') {
	return baseEncode(string, {
		fromEncoding: 'base64url',
		toEncoding,
	});
}

/**
 * Pack many numbers into a single string
 *
 * @memberof Crypt
 * @param  {Array} numbers array of numbers to be packed
 * @return {string}        packed string
 */
function packNumbers(numbers) {
	return baseConvert(
		numbers.join('a').replace(/-/g, 'b').replace(/\./g, 'c'),
		13, 62
	);
}

/**
 * Unpack a string packed with packNumbers
 *
 * @memberof Crypt
 * @param  {string} str string to be unpacked
 * @return {Array}      array of unpacked numbers
 */
function unpackNumbers(str) {
	return baseConvert(str, 62, 13)
		.replace(/b/g, '-')
		.replace(/c/g, '.')
		.split('a')
		.map(Number);
}

/**
 * Generate a random encrypted string that contains a timestamp.
 *
 * @memberof Crypt
 * @param {number|object} options length of the id or object of {length: int}
 * @param {number} options.length
 * @param {number} [options.time] epoch time / 1000
 * @return {string} id
 */
function encryptedTimestampedId(options, key) {
	const length = options.length || options;

	if (length < 10) {
		throw new Error('Timestamped ID should be of minimum 15 length');
	}

	let time = options.time || Math.floor(Date.now() / 1000);
	time = baseConvert(time, 10, 62);

	const encrypted = encryptStatic(randomString(3) + time, key);
	const remaining = length - encrypted.length - 1;
	let randomStr = '';
	if (remaining) {
		randomStr = randomString(remaining);
	}

	return encrypted + '.' + randomStr;
}

/**
 * Legacy obfuscation method
 *
 * @memberof Crypt
 * @param  {string} str the string to be obfuscted
 * @return {string} obfuscated string
 * @ignore
 */
async function javaObfuscate(str) {
	if (!str) return '';
	try {
		return base64Encode(await gzdeflate(Buffer.from(Str.rot47(str), 'latin1')));
	}
	catch (e) {
		return '';
	}
}

/**
 * Legacy unobfuscation method (obfuscated by javaObfuscate)
 *
 * @memberof Crypt
 * @param  {string} str the obfuscted string
 * @return {string} unobfuscated string
 * @ignore
 */
async function javaUnobfuscate(str) {
	str = str.trim();
	if (!str) return '';

	try {
		return Str.rot47((await gzinflate(base64Decode(str, 'buffer'))).toString('latin1'));
	}
	catch (e) {
		return '';
	}
}

/**
 * @type {Str.rot13}
 * @memberof Crypt
 */
const rot13 = Str.rot13;

/**
 * @type {Str.rot47}
 * @memberof Crypt
 */
const rot47 = Str.rot47;

module.exports = {
	baseConvert,
	chars,

	random,
	randomInt,
	randomString,
	randomID: randomString,
	randomId: randomString,
	sequentialID,
	sequentialId: sequentialID,

	sequentialUUID,
	randomUUID,
	uuid: randomUUID,

	shuffle,
	seededRandom,

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

	sign,
	verify,

	encrypt,
	decrypt,
	encryptStatic,
	decryptStatic,

	signAndEncrypt,
	verifyAndDecrypt,

	hashPassword,
	verifyPassword,

	baseEncode,
	baseDecode,
	baseDecodeToBuffer,
	base64Encode,
	base64UrlEncode,
	base64Decode,
	base64UrlDecode,

	packNumbers,
	unpackNumbers,

	encryptedTimestampedId,

	rot13,
	rot47,
	javaObfuscate,
	javaUnobfuscate,
};
