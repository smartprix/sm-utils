import {CookieJar} from 'request';
import {Stats} from 'fs';
import {ChildProcess} from 'child_process';
import {Redis} from 'ioredis';

declare module 'sm-utils' {
	/**
	 * Local cache with dogpile prevention
	 */
	class Cache {
		/**
		 * Local cache with dogpile prevention
		 */
		constructor();

		/**
		 * gets a value from the cache
		 * this is sync version, so it'll not help with dogpiling issues
		 * @param key
		 * @param defaultValue
		 */
		getSync(key: string, defaultValue: any):  any;

		/**
		 * gets a value from the cache
		 * @param key
		 * @param defaultValue
		 */
		get(key: string, defaultValue: any): Promise<any>;

		/**
		 * gets a value from the cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 */
		getStaleSync(key: string, defaultValue: any): any;

		/**
		 * gets a value from the cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 */
		getStale(key: string, defaultValue: any): any;

		/**
		 * checks if a key exists in the cache
		 * @param key
		 */
		hasSync(key: string): boolean;

		/**
		 * checks if a key exists in the cache
		 * @param key
		 */
		has(key: string): boolean;

		/**
		 * sets a value in the cache
		 * this is sync version, so value should not be a promise or async function
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		setSync(key: string, value: any, options?: setOpts): boolean;

		/**
		 * sets a value in the cache
		 * avoids dogpiling if the value is a promise or a function returning a promise
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		set(key: string, value: any, options?: setOpts): Promise<boolean>;

		/**
		 * gets a value from the cache, or sets it if it doesn't exist
		 * this is sync version, so value should not be a promise or async function
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		getOrSetSync<T>(key: string, value: T | ((...ags: any[]) => T), options?: setOpts): T;

		/**
		 * gets a value from the cache, or sets it if it doesn't exist
		 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		getOrSet<T>(key: string, value: T | Promise<T> | ((...ags: any[]) => T | Promise<T>), options?: setOpts): Promise<T>;

		/**
		 * alias for getOrSet
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		$<T>(key: string, value: T | Promise<T> | ((...ags: any[]) => T | Promise<T>), options?: setOpts): Promise<T>;

		/**
		 * deletes a value from the cache
		 * @param key
		 */
		delSync(key: string): void;

		/**
		 * deletes a value from the cache
		 * @param key
		 */
		del(key: string): void;

		/**
		 * returns the size of the cache (no. of keys)
		 */
		sizeSync(): number;

		/**
		 * clears the cache (deletes all keys)
		 */
		clearSync(): void;

		/**
		 * returns the size of the cache (no. of keys)
		 */
		size(): Promise<number>;

		/**
		 * clears the cache (deletes all keys)
		 */
		clear(): Promise<void>;

		/**
		 * memoizes a function (caches the return value of the function)
		 * ```js
		 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
		 * const result = cachedFn('a', 'b');
		 * ```
		 * This is sync version, so fn should not be async
		 * @param key cache key with which to memoize the results
		 * @param fn function to memoize
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		memoizeSync<T, U extends any[]>(key: string, fn: ((...args: U) => T), options?: setOpts): (...args: U) => T;

		/**
		 * memoizes a function (caches the return value of the function)
		 * ```js
		 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
		 * const result = cachedFn('a', 'b');
		 * ```
		 * @param key cache key with which to memoize the results
		 * @param fn function to memoize
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		memoize<T, U extends any[]>(key: string, fn: ((...args: U) => T | Promise<T>), options?: setOpts): (...args: U) => Promise<T>;

		/**
		 * returns a global cache instance
		 */
		static globalCache(): Cache;

		/**
		 * gets a value from the global cache
		 * this is sync version, so it'll not help with dogpiling issues
		 * @param key
		 * @param defaultValue
		 */
		static getSync(key: string, defaultValue: any): any;

		/**
		 * get a value from the global cache
		 * @param key
		 * @param defaultValue
		 */
		static get(key: string, defaultValue: any): Promise<any>;

		/**
		 * gets a value from the global cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 */
		static getStaleSync(key: string, defaultValue: any): any;

		/**
		 * gets a value from the global cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 */
		static getStale(key: string, defaultValue: any): any;

		/**
		 * checks if a key exists in the global cache
		 * @param key
		 */
		static hasSync(key: string): boolean;

		/**
		 * checks if value exists in the global cache
		 * @param key
		 */
		static has(key: string): boolean;

		/**
		 * sets a value in the global cache
		 * this is sync version, so value should not be a promise or async function
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static setSync(key: string, value: any, options?: setOpts): boolean;

		/**
		 * sets a value in the global cache
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static set(key: string, value: any, options?: setOpts): Promise<boolean>;

		/**
		 * gets a value from the global cache, or sets it if it doesn't exist
		 * this is sync version, so value should not be a promise or async function
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static getOrSetSync<T>(key: string, value: T | ((...ags: any[]) => T), options?: setOpts): T;

		/**
		 * gets a value from the global cache, or sets it if it doesn't exist
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static getOrSet<T>(key: string, value: T | Promise<T> | ((...ags: any[]) => T | Promise<T>), options?: setOpts): Promise<T>;

		/**
		 * alias for getOrSet
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static $<T>(key: string, value: T | Promise<T> | ((...ags: any[]) => T | Promise<T>), options?: setOpts): Promise<T>;

		/**
		 * deletes a value from the global cache
		 * @param key
		 */
		static delSync(key: string): void;

		/**
		 * deletes a value from the global cache
		 * @param key
		 */
		static del(key: string): void;

		static sizeSync(): number;

		/**
		 * clear the global cache
		 */
		static clearSync(): void;

		static size(): Promise<number>;

		/**
		 * clear the global cache
		 */
		static clear(): Promise<void>;

		/**
		 * memoizes a function (caches the return value of the function)
		 * ```js
		 * const cachedFn = cache.memoize('expensiveFn', expensiveFn);
		 * const result = cachedFn('a', 'b');
		 * ```
		 * This is sync version, so fn should not be async
		 * @param key cache key with which to memoize the results
		 * @param fn function to memoize
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static memoize<T, U extends any[]>(key: string, fn: ((...args: U) => T), options?: setOpts): (...args: U) => T;

		/**
		 * memoizes a function (caches the return value of the function)
		 * @param key
		 * @param fn
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		static memoize<T, U extends any[]>(key: string, fn: ((...args: U) => T | Promise<T>), options?: setOpts): (...args: U) => Promise<T>;

	}

	interface setOptsObject {
		/**
		 * in ms / timestring ('1d 3h') default: 0
		 */
		ttl: number | string;
	}

	type setOpts = string | number | setOptsObject;

	interface Constructor<M> {
		new (...args: any[]): M
	}
	/**
	 * Simple & Powerful HTTP request client.
	 */
	class Connect {
		/**
		 * Simple & Powerful HTTP request client.
		 */
		constructor();

		/**
		 * Set the url for the connection.
		 * @param url
		 */
		url(url: string): this;

		/**
		 *
		 * @param url
		 */
		static url<U extends Connect>(this: Constructor<U>, url: string): U;

		/**
		 *
		 * @param args
		 */
		static newCookieJar(...args: any[]): CookieJar;

		/**
		 * Set or unset the followRedirect option for the connection.
		 * @param shouldFollowRedirect boolean representing whether to follow redirect or not
		 */
		followRedirect(shouldFollowRedirect: boolean): this;

		/**
		 * Set the number of maximum redirects to follow
		 * @param numRedirects max number of redirects
		 */
		maxRedirects(numRedirects: number): this;

		/**
		 * Set value of a header parameter for the connection.
		 * @param headerName name of the header parameter whose value is to be set
		 * @param headerValue value to be set
		 */
		header(headerName: string, headerValue: any): this;

		/**
		 * Set value of the headers for the connection.
		 * @param headers object representing the headers for the connection
		 */
		headers(headers: object): this;

		/**
		 * Set the body of the connection object.
		 * @param body value for body
		 * @param contentType string representing the content type of the body
		 */
		body(body: any, contentType?: string): this;

		/**
		 * Set the 'Referer' field in the headers.
		 * @param referer referer value
		 */
		referer(referer: string): this;

		/**
		 * Set the 'User-Agent' field in the headers.
		 * @param userAgent name of the user-agent or its value
		 */
		userAgent(userAgent: string): this;

		/**
		 * Set the 'Content-Type' field in the headers.
		 * @param contentType value for content-type
		 */
		contentType(contentType: string): this;

		/**
		 * Returns whether the content-type is JSON or not
		 */
		isJSON(): boolean;

		/**
		 * Sets the value of a cookie.
		 * Set multiple cookies by passing in an object
		 * representing the cookies and their values as key:value pairs.
		 * @param cookies cookie object
		 */
		cookie(cookies: object): this;
		/**
 		 * @param cookieName represents the name of the
		 * cookie to be set
		 * @param cookieValue cookie value to be set

		 */
		cookie(cookieName: string, cookieValue: any): this;
		/**
		 * Can be used to enable global cookies, if cookieName is set to true
		 * @param cookieName
		 */
		cookie(cookieName: true): this;

		/**
		 * Sets multiple cookies.
		 * @param cookies object representing the cookies
		 *	and their values as key:value pairs.
		 */
		cookies(cookies: object): this;
		/**
		 * Enable global cookies, if cookies is set to true.
		 * @param cookies
		 */
		cookies(cookies: true): this;

		/**
		 * Enable global cookies.
		 * @param enableGlobalCookies
		 */
		globalCookies(enableGlobalCookies?: boolean): this;

		/**
		 * Set the value of cookie jar based on a file (cookie store).
		 * @param fileName name of (or path to) the file
		 */
		cookieFile(fileName: string): this;

		/**
		 * Set the value of cookie jar.
		 * @param cookieJar value to be set
		 */
		cookieJar(cookieJar: CookieJar): this;

		/**
		 * Set request timeout.
		 * @param timeout timeout value in seconds
		 */
		timeout(timeout: number): this;

		/**
		 * Set request timeout.
		 * @param timeoutInMs timeout value in milliseconds
		 */
		timeoutMs(timeoutInMs: number): this;

		/**
		 * alias for timeoutMs
		 * @param timeoutInMs
		 */
		timeoutMilli(timeoutInMs: number): this;

		/**
		 * Set value of a field in the options.
		 * Can also be used to set multiple fields by passing in an object
		 * representing the field-names and their values as key:value pairs.
		 * @param fieldName name of the field to be set, or the fields object
		 * @param fieldValue value to be set
		 */
		field(fieldName: string, fieldValue: any): this;
		field(fieldName: object): this;

		/**
		 * Set multiple fields.
		 * @param fields object representing the field-names and their
		 *	values as key:value pairs
		 */
		fields(fields: object): this;

		/**
		 * Set the request method for the connection.
		 * @param method one of the HTTP request methods ('GET', 'PUT', 'POST', etc.)
		 */
		method(method: string): this;

		/**
		 * Set username and password for authentication.
		 * @param username
		 * @param password
		 */
		httpAuth(username: string, password: string): this;

		/**
		 * Set proxy address (or options).
		 * @param proxy proxy address, or object representing proxy options
		 */
		proxy(proxy: string): this;
		proxy(proxy: {address: string, port?: number, type?: 'http' | 'https' | 'socks' | 'socks5', auth?: auth}): this;

		/**
		 * Set address and port for an http proxy.
		 * @param proxyAddress
		 * @param proxyPort
		 */
		httpProxy(proxyAddress: string, proxyPort: number): this;

		/**
		 * Set address and port for a socks proxy.
		 * @param proxyAddress
		 * @param proxyPort
		 */
		socksProxy(proxyAddress: string, proxyPort: number): this;

		/**
		 * Set username and password for proxy.
		 */
		proxyAuth(auth: auth): this;
		proxyAuth(username: string, password: string): this;

		/**
		 * Set request method to 'GET'.
		 */
		get(): this;

		/**
		 * Set request method to 'POST'.
		 */
		post(): this;

		/**
		 * Set request method to 'PUT'.
		 */
		put(): this;

		/**
		 * Set cache directory for the connection.
		 * @param dir name or path to the directory
		 */
		cacheDir(dir: string): this;

		/**
		 * Set if the body is to be returned as a buffer
		 * @param returnAsBuffer
		 */
		asBuffer(returnAsBuffer?: boolean): this;

		/**
		 * Set the path for file for saving the response.
		 * @param filePath
		 */
		save(filePath: string): this;

		/**
		 * It creates and returns a promise based on the information
		 * passed to and parameters of this object.
		 */
		fetch(): Promise<response>;

		/**
		 * It is used for method chaining.
		 * @param successCallback function to be called if the Promise is fulfilled
		 */
		then<T>(successCallback: (res: response) => T): Promise<T>;
		/**
		 * It is used for method chaining.
		 * @param successCallback function to be called if the Promise is fulfilled
		 * @param errorCallback function to be called if the Promise is rejected
		 */
		then<T, U>(successCallback: (res: response) => T, errorCallback: (err: Error) => U): Promise<T | U>;

		/**
		 * It is also used for method chaining, but handles rejected cases only.
		 * @param errorCallback function to be called if the Promise is rejected
		 */
		catch<T>(errorCallback: (err: Error) => T): Promise<any>;

	}

	interface auth {username: string, password: string}

	interface response {
		/**
		 * the actual response body
		 */
		body: string;
		/**
		 * the final url downloaded after following all redirects
		 */
		url: string;
		/**
		 * time taken (in ms) for the request
		 */
		timeTaken: number;
		/**
		 * false if the response was downloaded, true if returned from a cache
		 */
		cached: boolean;
		statusCode: number;
	}

	/**
	 * Cryptographic utilities
	 */
	namespace Crypt {
		/**
		 * different charsets available
		 */
		const chars: object;

		/**
		 * Return a random number between 0 and 1
		 */
		function random(): number;

		/**
		 * Return a random integer between min and max (both inclusive)
		 * @param num If max is not passed, num is max and min is 0
		 * @param max max value of int, num will be min
		 */
		function randomInt(num: number, max?: number): number;

		/**
		 * Generate a random string based on the options passed.
		 * It can be treated as a Random UUID.
		 *
		 * You can give length and charset in options.
		 * If options is an integer it will treated as length.
		 * By default, length is 20 and charset is ALPHA_NUMERIC
		 * @param options length of the id or options object
		 */
		function randomString(options: number | randomStringOpts): string;

		/**
		 * Shuffle an array or a string.
		 * @param itemToShuffle item which you want to shuffle
		 * @param options  object of {seed: number}
		 * @param options.randomFunc Use this random function instead of default
		 * @param options.seed optionally give a seed to do a constant shuffle
		 */
		function shuffle<T>(itemToShuffle: T[], options: shuffle_options): T[];
		function shuffle(itemToShuffle: string, options: shuffle_options): string;

		/**
		 *
		 * @param seed integer
		 */
		function seededRandom(seed: number): randomFunctions;

		/**
		 * Get nanoseconds in base62 or base36 format.
		 * @param base36 use base36 format or not
		 */
		function nanoSecondsAlpha(base36?: boolean): string;

		/**
		 * Generate a sequential id based on current time in millisecond and some randomness.
		 * It can be treated as a Sequential UUID. Ideal for use as a DB primary key.
		 *
		 * NOTE: For best results use atleast 15 characters in base62 and 18 characters in base36 encoding
		 * @param options length of the id or object of {length: int, base36: bool}
		 */
		function sequentialID(options: number | object): string;

		/**
		 * Get sequential ID in v4 UUID format.
		 */
		function sequentialUUID(): void;

		/**
		 * Get random ID in v4 UUID format.
		 */
		function randomUUID(): void;

		/**
		 * Encode the string/buffer using a given encoding.
		 * Supported Encodings:
		 * 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url',
		 * 'utf8', 'buffer', 'utf16le' ('ucs2')
		 * @param string item to be encoded
		 * @param opts object or string specifying the encoding(s)
		 */
		function baseEncode(string: string | Buffer, opts: encodingConversion | string): string | Buffer;

		/**
		 * Decode a string encoded using a given encoding.
		 * @param string item to be decoded
		 * @param opts object or string specifying the encoding(s)
		 */
		function baseDecode(string: string | Buffer, opts: encodingConversion | string): string;

		/**
		 * Decode a string encoded using a given encoding to a buffer.
		 * @param string item to be decoded
		 * @param fromEncoding encoding used to encode the string
		 */
		function baseDecodeToBuffer(string: string | Buffer, fromEncoding: string): Buffer;

		/**
		 * Compute hash of a string using given algorithm
		 * encoding can be 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
		 * @param algo algo to be used for hashing
		 * @param string string to be hashed
		 * @param opts
		 */
		function hash(algo: string, string: string, opts?: encodingOpts): string;

		/**
		 * Compute hash of a string using md5
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function md5(string: string, options?: encodingOpts): string;

		/**
		 * Compute hash of a string using sha1
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha1(string: string, options?: encodingOpts): string;

		/**
		 * Compute hash of a string using sha256
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha256(string: string, options?: encodingOpts): string;

		/**
		 * Compute hash of a string using sha384
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha384(string: string, options?: encodingOpts): string;

		/**
		 * Compute hash of a string using sha512
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha512(string: string, options?: encodingOpts): string;

		/**
		 * Create cryptographic HMAC digests using given algo
		 * @param algo algo to be used for hashing
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function hmac(algo: string, string: string, options?: encodingOpts): string;

		/**
		 * Create cryptographic HMAC digests using sha1
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha1Hmac(string: string, options?: encodingOpts): string;

		/**
		 * Create cryptographic HMAC digests using sha256
		 * @param string string to be hashed
		 * @param options object of {encoding}
		 */
		function sha256Hmac(string: string, options?: encodingOpts): string;

		/**
		 * Sign a message using a private key.
		 *
		 * NOTE: Generate a key pair using:
		 * ```sh
		 * openssl ecparam -genkey -name secp256k1 | openssl ec -aes128 -out private.pem
		 * openssl ec -in private.pem -pubout -out public.pem
		 * ```
		 * @param message the message to be signed
		 * @param privateKey
		 * @param opts opts can have {encoding (default 'hex')
		 */
		function sign(message: string, privateKey: string | object, opts: encodingOpts): string;

		/**
		 * Verify a message using a public key
		 * opts can have {encoding (default 'hex')}
		 *
		 * NOTE: Generate a key pair using:
		 * ```sh
		 * openssl ecparam -genkey -name secp256k1 | openssl ec -aes128 -out private.pem
		 * openssl ec -in private.pem -pubout -out public.pem
		 * ```
		 * @param message message to be verified
		 * @param signature
		 * @param publicKey
		 * @param opts opts can have {encoding (default 'hex')}
		 */
		function verify(message: string, signature: string, publicKey: string | object, opts?: encodingOpts): boolean;

		/**
		 * Encrypt the given string with the given key using AES 256
		 * Calling encrypt on the same string multiple times will return different encrypted strings
		 * Optionally specify encoding in which you want to get the output
		 * @param string string to be encrypted
		 * @param key key to be used
		 * @param options object of {encoding} (default: 'base64url')
		 */
		function encrypt(string: string, key: string, options?: encodingOpts): string;

		/**
		 * Decrypt the given string with the given key encrypted using encrypt
		 * @param string string to be decrypted
		 * @param key key to be used
		 * @param options object of {encoding} (default: 'base64url')
		 */
		function decrypt(string: string, key: string, options?: encodingOpts): string;

		/**
		 * Encrypt the given string with the given key using AES 256
		 * Calling EncryptStatic on the same string multiple times will return same encrypted strings
		 * this encryption is weaker than Encrypt but has the benefit of returing same encrypted string
		 * for same string and key.
		 * @param string string to be encrypted
		 * @param key key to be used
		 * @param options object of {encoding} (default: 'base64url')
		 */
		function encryptStatic(string: string, key: string, options?: encodingOpts): string;

		/**
		 * Decrypt the given string with the given key encrypted using encryptStatic
		 * @param string string to be decrypted
		 * @param key key to be used
		 * @param options object of {encoding} (default: 'base64url')
		 */
		function decryptStatic(string: string, key: string, options?: encodingOpts): string;

		/**
		 * Convert a message into an encrypted token by:
		 * signing it with privateKey + encrypting it with publicKey
		 * you only need a publicKey to verify and decrypt this token
		 * @param message will be JSON.stringified
		 * @param privateKey
		 * @param publicKey
		 */
		function signAndEncrypt(message: any, privateKey: string | object, publicKey: string): string;

		/**
		 * Convert an encrypted token (generated by signAndEncrypt) into a message
		 * @param token generated by signAndEncrypt
		 * @param publicKey
		 */
		function verifyAndDecrypt(token: string, publicKey: string): void;

		/**
		 * Hash a given password using cryptographically strong hash function
		 * @param password
		 * @param opts
		 * @param opts.salt
		 */
		function hashPassword(password: string, opts: hashPassword_opts): string;

		/**
		 * Verify that given password and hashed password are same or not
		 * @param password
		 * @param hashed
		 */
		function verifyPassword(password: string, hashed: string): boolean;

		/**
		 * Base64 Encode
		 * @param string
		 * @param fromEncoding
		 */
		function base64Encode(string: string, fromEncoding?: string): void;

		/**
		 * URL Safe Base64 Encode
		 * @param string
		 * @param fromEncoding
		 */
		function base64UrlEncode(string: string, fromEncoding?: string): void;

		/**
		 * Base64 Decode
		 * @param string
		 * @param toEncoding
		 */
		function base64Decode(string: string, toEncoding?: string): void;

		/**
		 * URL Safe Base64 Decode
		 * @param string
		 * @param toEncoding
		 */
		function base64UrlDecode(string: string, toEncoding?: string): void;

		/**
		 * Pack many numbers into a single string
		 * @param numbers array of numbers to be packed
		 */
		function packNumbers(numbers: any[]): string;

		/**
		 * Unpack a string packed with packNumbers
		 * @param str string to be unpacked
		 */
		function unpackNumbers(str: string): any[];

		/**
		 * Generate a random encrypted string that contains a timestamp.
		 * @param options length of the id or object of {length: int}
		 * @param options.length
		 * @param options.time epoch time / 1000
		 */
		function encryptedTimestampedId(options: encryptedTimestampedId_options): string;

		/**
		 * Legacy obfuscation method
		 * @param str the string to be obfuscted
		 */
		function javaObfuscate(str: string): Promise<string>;

		/**
		 * Legacy unobfuscation method (obfuscated by javaObfuscate)
		 * @param str the obfuscted string
		 */
		function javaUnobfuscate(str: string): Promise<string>;

		const rot13: typeof Str.rot13;

		const rot47: typeof Str.rot47;

		/**
		 * convert arbitary long integer from one base to another
		 * Taken from decimal.js
		 * @param str number in base 'baseIn'
		 * @param baseIn input base
		 * @param baseOut output base
		 */
		function baseConvert(str: string | number, baseIn?: number, baseOut?: number): string;

	}

	interface randomOpts {
		/**
		 * integer
		 */
		length?: number;
		/**
		 * if true will use BASE_36 charset
		 */
		base36?: boolean;
		/**
		 * provide a charset string
		 */
		charset?: string;
	}

	interface shuffle_options {
		/**
		 * Use this random function instead of default
		 */
		randomFunc?: () => number;
		/**
		 * optionally give a seed to do a constant shuffle
		 */
		seed?: number;
	}

	interface randomStringOpts extends randomOpts {
		randomBytesFunc?: (size: number) => Buffer;
	}

	interface randomFunctions {
		seed: number;
		index: number;
		/**
		 * number b/w 0 and 1
		 */
		random(): number;
		/**
		 * Return a random integer between min and max (both inclusive)
		 * @param num If max is not passed, num is max and min is 0
		 * @param max max value of int, num will be min
		 */
		int(num: number, max?: number): number;
		bytes(size: number): Buffer;
		string(opts: number | randomOpts): string;
		shuffle<T>(items: T[]): T[];
		shuffle(items: string): string;
	}

	/**
	 * Supported Encodings:
	 * 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url',
	 * 'utf8', 'buffer', 'utf16le' ('ucs2')
	 */
	interface encodingConversion {
		/**
		 * default 'base64url'
		 */
		toEncoding?: string;
		/**
		 * default 'binary'
		 */
		fromEncoding?: string;
	}

	/**
	 * Supported Encodings:
	 * 'hex', 'binary' ('latin1'), 'ascii', 'base64', 'base64url', 'utf8', 'buffer'
	 */
	interface encodingOpts {
		/**
		 * default 'hex'
		 */
		encoding?: string;
	}

	interface hashPassword_opts {
		salt: string | Buffer;
	}

	interface encryptedTimestampedId_options {
		length: number;
		/**
		 * epoch time / 1000
		 */
		time?: number;
	}

	/**
	 * Custom implementation of a double ended queue.
	 */
	class DeQueue {
		/**
		 * Custom implementation of a double ended queue.
		 */
		constructor(array: any[]);

		/**
		 * Returns the item at the specified index from the list.
		 * 0 is the first element, 1 is the second, and so on...
		 * Elements at negative values are that many from the end: -1 is one before the end
		 * (the last element), -2 is two before the end (one before last), etc.
		 * @param index
		 */
		peekAt(index: any): any;

		/**
		 * Alias for peakAt()
		 * @param i
		 */
		get(i: any): any;

		/**
		 * Sets the queue value at a particular index
		 * @param index integer
		 * @param value
		 */
		set(index: number, value: any): any;

		/**
		 * Returns the first item in the list without removing it.
		 */
		peek(): any;

		/**
		 * Alias for peek()
		 */
		peekFront(): any;

		/**
		 * Alias for peek()
		 */
		head(): any;

		/**
		 * Returns the item that is at the back of the queue without removing it.
		 * Uses peekAt(-1)
		 */
		peekBack(): void;

		/**
		 * Alias for peekBack()
		 */
		tail(): any;

		/**
		 * Return the number of items on the list, or 0 if empty.
		 */
		size(): number;

		/**
		 * alias for this.size()
		 */
		length: any;

		/**
		 * Add an item at the beginning of the list.
		 * @param item
		 */
		unshift(item: any): void;

		/**
		 * Remove and return the first item on the list
		 * Returns undefined if the list is empty.
		 */
		shift(): any;

		/**
		 * Alias for shift()
		 */
		dequeue(): void;

		/**
		 * Add an item to the bottom of the list.
		 * @param item
		 */
		push(item: any): void;

		/**
		 * Alias for push()
		 */
		enqueue(): void;

		/**
		 * Remove and return the last item on the list.
		 * Returns undefined if the list is empty.
		 */
		pop(): any;

		/**
		 * Remove and return the item at the specified index from the list.
		 * Returns undefined if the list is empty.
		 * @param index
		 */
		removeOne(index: any): any;

		/**
		 * Remove number of items from the specified index from the list.
		 * Returns array of removed items.
		 * Returns undefined if the list is empty.
		 * @param index
		 * @param count
		 */
		remove(index: any, count: any): any[];

		/**
		 * Native splice implementation.
		 * Remove number of items from the specified index from the list and/or add new elements.
		 * Returns array of removed items or empty array if count == 0.
		 * Returns undefined if the list is empty.
		 * @param index
		 * @param count
		 * @param args
		 */
		splice(index: any, count: any, ...args: any[]): any[];

		/**
		 * Soft clear - does not reset capacity.
		 */
		clear(): void;

		/**
		 * Returns true or false whether the list is empty.
		 */
		isEmpty(): boolean;

		/**
		 * Returns an array of all queue items.
		 */
		toArray(): any[];

	}

	/**
	 * File System utilities wrapped in a class
	 */
	class File {
		/**
		 * File System utilities wrapped in a class
		 */
		constructor(path: string);

		/**
		 * Checks whether a file exists already.
		 */
		exists(): Promise<boolean>;

		/**
		 * Checks whether a file exists already.
		 */
		existsSync(): boolean;

		/**
		 * Returns whether this File object represents a file.
		 */
		isFile(): Promise<boolean>;

		/**
		 * Returns whether this File object represents a directory.
		 */
		isDir(): Promise<boolean>;

		/**
		 * Returns a Date object representing the time when file was last modified.
		 */
		mtime(): Promise<Date | 0>;

		/**
		 * Returns a Date object representing the time when file was last changed.
		 */
		ctime(): Promise<Date | 0>;

		/**
		 * Returns a Date object representing the time when file was last accessed.
		 */
		atime(): Promise<Date | 0>;

		/**
		 * Returns a Date object representing the time when file was created.
		 */
		crtime(): Promise<Date | 0>;

		/**
		 * Returns an object with the stats of the file. If the path for the file
		 * is a symlink, then stats of the symlink are returned.
		 */
		lstat(): Promise<Stats>;

		/**
		 * Returns an object with the stats of the file. If the path for the file
		 * is a symlink, then stats of the target of the symlink are returned.
		 */
		stat(): Promise<Stats>;

		/**
		 * Returns the size of the file in bytes. If the file is not found
		 * or can't be read successfully, 0 is returned.
		 */
		size(): Promise<number>;

		/**
		 * Change the mode of the file. Return 0 on success, -1 on error
		 * @param mode An octal number or a string representing the file mode
		 */
		chmod(mode: number | string): Promise<0 | -1>;

		/**
		 * Change the mode of the file or directory recursively.
		 * @param mode An octal number or a string representing the file mode
		 */
		chmodr(mode: number | string): Promise<0 | -1>;

		/**
		 * Change the owner and group of the file.
		 * @param user user id, or user name
		 * @param group group id, or group name
		 */
		chown(user: number | string, group: number | string): Promise<0 | -1>;

		/**
		 * Change the owner and group of the file recursively.
		 * @param user user id, or user name
		 * @param group group id, or group name
		 */
		chownr(user: number | string, group: number | string): Promise<0 | -1>;

		/**
		 * Change the name or location of the file.
		 * @param newName new path/location (not just name) for the file
		 */
		rename(newName: string): Promise<0 | -1>;

		/**
		 * Move file to a new location
		 * @param newName new location (or path) for the file
		 */
		mv(newName: string): Promise<0 | -1>;

		/**
		 * Unlink the path from the file.
		 *
		 * NOTE: If the path referred to a
		 * symbolic link, the link is removed. If the path is the only link
		 * to the file then the file will be deleted.
		 */
		unlink(): Promise<void>;

		/**
		 * Remove the file.
		 *
		 * NOTE: The path is unlinked from the file, but the file
		 * is deleted only if the path was the only link to the file and
		 * the file was not opened in any other process.
		 */
		rm(): Promise<void>;

		/**
		 * Remove the directory.
		 *
		 * NOTE: The directory will be deleted only if it is empty.
		 */
		rmdir(): Promise<void>;

		/**
		 * Recursively delete the directory and all its contents.
		 */
		rmrf(): Promise<void>;

		/**
		 * Create a directory.
		 * @param mode  file mode for the directory
		 */
		mkdir(mode?: number): Promise<void>;

		/**
		 * Create a new directory and any necessary subdirectories.
		 * @param mode  file mode for the directory
		 */
		mkdirp(mode?: number): Promise<void>;

		/**
		 * Perform a glob search with the path of the file as the pattern.
		 */
		glob(): Promise<string[]>;

		/**
		 * Read contents of the file.
		 */
		read(): Promise<string | Buffer>;

		/**
		 * Create (all necessary directories for) the path of the file/directory.
		 * @param mode  file mode for the directory
		 */
		mkdirpPath(mode?: number): Promise<void>;

		/**
		 * Write contents to the file.
		 * @param contents contents to be written to the file
		 * @param options  contains options for writing to the file
		 *
		 * The options can include parameters such as fileMode, dirMode, retries and encoding.
		 */
		write(contents: string | Buffer, options?: writeOpts): Promise<void>;

		/**
		 * Append contents to the file.
		 * @param contents contents to be written to the file
		 * @param options  contains options for appending to the file
		 *
		 * The options can include parameters such as fileMode, dirMode, retries and encoding.
		 */
		append(contents: string | Buffer, options?: writeOpts): Promise<void>;

		/**
		 * Copy the file to some destination.
		 * @param destination path of the destination
		 * @param options  options for copying the file
		 *
		 * If the overwrite option is explicitly set to false, only then
		 * will the function not attempt to overwrite the file if it (already)
		 * exists at the destination.
		 */
		copy(destination: string, options?: {overwrite?: boolean}): Promise<void>;

		/**
		 * Return the canonicalized absolute pathname
		 */
		realpath(): Promise<string>;

		/**
		 * Return the canonicalized absolute pathname
		 */
		realpathSync(): string;

	}

	interface writeOpts {
		fileMode?: number;
		dirMode?: number;
		retries?: number;
	}

	/**
	 * Returns a new File object representing the file located at 'path'.
	 * @param path path of the file
	 */
	function file(path: string): File;

	class Lock {
		constructor();

		/**
		 *
		 * @param key
		 */
		tryAcquire(key: string): Promise<boolean>;

		/**
		 *
		 * @param key
		 */
		acquire(key: string): Promise<boolean | void>;

		/**
		 * release a lock
		 * @param key
		 */
		release(key: string): Promise<void>;

	}

	/**
	 * Job Queue
	 */
	class Queue {
		/**
		 * Job Queue
		 */
		constructor(name: string, redis?: object, options?: boolean | queueOpts);

		/**
		 * Initialise the redis connection
		 * @param redis Redis connection settings object
		 * @param enableWatchdog Will watch for stuck jobs due to any connection issues
		 * @see https://github.com/Automattic/kue#unstable-redis-connections
		 */
		static init(redis?: object, enableWatchdog?: boolean): void;

		/**
		 * Add a job to the Queue
		 * @param input Job data
		 * @param opts
		 */
		addJob(input: any, opts: addOpts): Promise<number>;

		/**
		 * Add a job to the Queue, wait for it to process and return result
		 * Preferably set PRIORITY HIGH or it might timeout if lots of other tasks are in queue
		 * Queue will process job only if timeout is not passed when processing begins
		 * @param input Job data
		 * @param opts
		 * @param timeout wait for this time else throw err
		 */
		addAndProcess(input: any, opts: addOpts, timeout?: number): Promise<any>;

		/**
		 * Set default number of retry attempts for any job added later
		 * @param attempts Number of attempts (>= 0), default = 1
		 */
		setAttempts(attempts: number): void;

		/**
		 * Set delay b/w successive jobs for any job added later
		 * @param delay Delay b/w jobs, milliseconds, default = 0
		 */
		setDelay(delay: number): void;

		/**
		 * Set default TTL (time to live) for new jobs added from now on,
		 * will fail job if not completed in TTL time
		 * @param ttl Time in milliseconds, infinite when 0. default = 0
		 */
		setTTL(ttl: number): void;

		/**
		 * Sets default removeOnComplete for any job added to this Queue from now on
		 * @param removeOnComplete default = false
		 */
		setRemoveOnCompletion(removeOnComplete: boolean): void;

		/**
		 * Sets default noFailure for any job added to this Queue from now on.
		 * This will mark the job complete even if it fails when true
		 * @param noFailure default = false
		 */
		setNoFailure(noFailure: boolean): void;

		/**
		 * Attach a processor to the Queue which will keep getting jobs as it completes them
		 * @param processor Function to be called to process the job data
		 * @param concurrency The number of jobs this processor can handle parallely
		 */
		addProcessor(processor: processorCallback, concurrency?: number): Promise<void>;

		/**
		 * Pause Queue processing
		 * Gives timeout time to all workers to complete their current jobs then stops them
		 * @param timeout Time to complete current jobs in ms
		 */
		pauseProcessor(timeout?: number): Promise<void>;

		/**
		 * Resume Queue processing
		 */
		resumeProcessor(): void;

		/**
		 * Return count of jobs in Queue of JobType
		 * @param queue Queue name
		 * @param jobType One of {'inactive', 'delayed' ,'active', 'complete', 'failed'}
		 */
		static getCount(queue: string, jobType: string): Promise<number>;

		/**
		 * Return count of inactive jobs in Queue
		 */
		inactiveJobs(): Promise<number>;

		/**
		 * Alias for inactiveJobs
		 */
		pendingJobs(): Promise<number>;

		/**
		 * Return count of completed jobs in Queue
		 * Might return 0 if removeOnComplete was true
		 */
		completedJobs(): Promise<number>;

		/**
		 * Return count of failed jobs in Queue
		 */
		failedJobs(): Promise<number>;

		/**
		 * Return count of delayed jobs in Queue
		 */
		delayedJobs(): Promise<number>;

		/**
		 * Return count of active jobs in Queue
		 */
		activeJobs(): Promise<number>;

		/**
		 * Process a single job in the Queue and mark it complete or failed,
		 * for when you want to manually process jobs
		 * @param processor Function to be called to process the job data, without ctx
		 */
		processJob(processor: processorCallback): Promise<jobDetails>;

		/**
		 * Cleanup function to be called during startup,
		 * resets active jobs older than specified time
		 * @param olderThan Time in milliseconds, default = 5000
		 */
		cleanup(olderThan?: number): Promise<void>;

		/**
		 * Removes any old jobs from queue
		 * older than specified time
		 * @param olderThan Time in milliseconds, default = 3600000 (1 hr)
		 */
		delete(olderThan?: number): Promise<void>;

		/**
		 * Function to query the status of a job
		 * @param jobId Job id for which status info is required
		 */
		static status(jobId: number): Promise<jobDetails>;

		/**
		 * Manualy process a specific Job. Returns existing result if job already processed
		 * @param jobId Id of the job to be processed
		 * @param processor Function to be called to process the job data, without ctx
		 */
		static processJobById(jobId: number, processor: processorCallback): Promise<jobDetails>;

		/**
		 * Function shuts down the Queue gracefully.
		 * Waits for active jobs to complete until timeout, then marks them failed.
		 * @param timeout Time in milliseconds, default = 10000
		 */
		static exit(timeout?: number): Promise<boolean>;

	}

	interface queueOpts {
		/**
		 * Will watch for stuck jobs default: false
		 */
		enableWatchdog?: boolean;
		/**
		 * default logs to console
		 */
		logger?: Console;
	}

	interface addOpts {
		/**
		 * Priority of the job, lower number is better
		 * Options are : low: 10, normal: 0, medium: -5, high: -10, critical: -15 | Or any integer
		 */
		priority?: number | string;
		/**
		 * Number of attempts
		 */
		attempts?: number;
		/**
		 * Delay in between jobs
		 */
		delay?: number;
		/**
		 * Time to live for job
		 */
		ttl?: number;
		/**
		 * Remove job on completion
		 */
		removeOnComplete?: boolean;
		/**
		 * Mark job as complete even if it fails
		 */
		noFailure?: boolean;
	}

	/**
	 * An async function which will be called to process the job data
	 * @param jobData The information saved in the job during adding of job
	 */
	type processorCallback = (jobData: any)=>any;

	/**
	 * Internal data object
	 */
	interface internalData {
		/**
		 * Input data given to job
		 */
		input: any;
		/**
		 * Internal options used to set noFailure and extra properties
		 */
		options: object;
	}

	/**
	 * Job status object.
	 */
	interface jobDetails {
		id: number;
		/**
		 * Name of the Queue
		 */
		type: string;
		/**
		 * Internal data object, includes input and options
		 */
		data: internalData;
		/**
		 * Result of the processor callback
		 */
		result: any;
		/**
		 * One of {'inactive', 'delayed' ,'active', 'complete', 'failed'}
		 */
		state: string;
		error: any;
		/**
		 * unix time stamp
		 */
		created_at: number;
		/**
		 * unix time stamp
		 */
		updated_at: number;
		/**
		 * Attempts Object
		 */
		attempts: object;
	}

	/**
	 * Cache backed by Redis
	 */
	class RedisCache {
		static globalPrefix: string;
		static useLocalCache: boolean;
		static logger: Partial<Console>;
		static defaultRedisConf: {
			host: string;
			port: number;
			password?: string;
		};
		/**
		 * this causes performace issues, use only when debugging
		 */
		static logOnLocalWrite: boolean;
		/**
		 * Cache backed by Redis
		 */
		constructor(prefix: string, redisConf?: redisConf|Redis, options?: redisCacheOpts);

		/**
		 * bypass the cache and compute value directly (useful for debugging / testing)
		 * NOTE: this'll be only useful in getOrSet or memoize, get will still return from cache
		 * @param bypass whether to bypass the cache or not
		 */
		bypass(bypass?: boolean): void;

		/**
		 * gets whether the cache is bypassed or not
		 * @returns
		 */
		isBypassed(): boolean;

		/**
		 * bypass the cache and compute value directly (useful for debugging / testing)
		 * NOTE: RedisCache.bypass will turn on bypassing for all instances of RedisCache
		 * For bypassing a particular instance, use [`instance.bypass()`]{@link RedisCache#bypass}
		 * @see [bypass]{@link RedisCache#bypass}
		 * @param bypass default true
		 */
		static bypass(bypass?: boolean): void;

		/**
		 * gets whether the cache is bypassed or not
		 * @returns
		 */
		static isBypassed(): boolean;

		/**
		 * gets a value from the cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 * @param options
		 */
		getStale(key: string, defaultValue?: any, options?: getRedisOpts): Promise<any>;

		/**
		 * gets a value from the cache
		 * @param key
		 * @param defaultValue
		 * @param options
		 */
		get(key: string, defaultValue?: any, options?: getRedisOpts): Promise<any>;

		/**
		 * checks if a key exists in the cache
		 * @param key
		 */
		has(key: string): Promise<boolean>;

		/**
		 * sets a value in the cache
		 * avoids dogpiling if the value is a promise or a function returning a promise
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') or opts (default: 0)
		 */
		set(key: string, value: any, options?: number | string | setRedisOpts): Promise<boolean>;

		/**
		 * gets a value from the cache, or sets it if it doesn't exist
		 * this takes care of dogpiling (make sure value is a function to avoid dogpiling)
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		getOrSet<T>(key: string, value: T | Promise<T> | ((...args: any[]) => T | Promise<T>), options?: number | string | setRedisOpts): Promise<T>;

		/**
		 * alias for getOrSet
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		$<T>(key: string, value: T | Promise<T> | ((...args: any[]) => T | Promise<T>), options?: number | string | setRedisOpts): Promise<T>;

		/**
		 * deletes a value from the cache
		 * @param key
		 */
		del(key: string): Promise<void>;

		/**
		 * NOTE: this method is expensive, so don't use it unless absolutely necessary
		 */
		size(): Promise<number>;

		/**
		 * clears the cache (deletes all keys)
		 * NOTE: this method is expensive, so don't use it unless absolutely necessary
		 */
		clear(): Promise<void>;

		/**
		 * memoizes a function (caches the return value of the function)
		 * @param key cache key with which to memoize the results
		 * @param fn function to memoize
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		memoize<T, U extends any[]>(key: string, fn: ((...args: U) => T | Promise<T>), options?: number | string | setRedisOpts): (...args: U) => Promise<T>;

		/**
		 * delete everything from cache if the key includes a particular string
		 * to delete everything from cache, use `_all_` as string
		 * @param str
		 */
		delContains(str: string): Promise<number>;

		/**
		 * Return a global instance of Redis cache
		 * @param redis redis redisConf
		 */
		static globalCache<T extends RedisCache>(this: Constructor<T>, redis: object): T;

		/**
		 * gets a value from the cache immediately without waiting
		 * @param key
		 * @param defaultValue
		 */
		static getStale(key: string, defaultValue: any): Promise<any>;

		/**
		 * gets a value from the global cache
		 * @param key
		 * @param defaultValue
		 */
		static get(key: string, defaultValue: any): Promise<any>;

		/**
		 * checks if a key exists in the global cache
		 * @param key
		 */
		static has(key: string): Promise<boolean>;

		/**
		 * sets a value in the global cache
		 * @param key
		 * @param value
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		static set(key: string, value: any, options?: number | string | setRedisOpts): Promise<boolean>;

		/**
		 * gets a value from the global cache, or sets it if it doesn't exist
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		static getOrSet<T>(key: string, value: T | Promise<T> | ((...args: any[]) => T | Promise<T>), options?: number | string | setRedisOpts): Promise<T>;

		/**
		 * alias for getOrSet
		 * @param key key to get
		 * @param value value to set if the key does not exist
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		static $<T>(key: string, value: T | Promise<T> | ((...args: any[]) => T | Promise<T>), options?: number | string | setRedisOpts): Promise<T>;

		/**
		 * deletes a value from the global cache
		 * @param key
		 */
		static del(key: string): Promise<void>;

		static size(): Promise<number>;

		/**
		 * clears the global cache (deletes all keys)
		 */
		static clear(): Promise<void>;

		/**
		 * memoizes a function (caches the return value of the function)
		 * @param key
		 * @param fn
		 * @param options ttl in ms/timestring('1d 3h') (default: 0)
		 *	or opts with parse and ttl
		 */
		static memoize<T, U extends any[]>(key: string, fn: ((...args: U) => T | Promise<T>), options?: number | string | setRedisOpts): (...args: U) => Promise<T>;

	}

	interface redisConf {
		host: string;
		port: number;
		auth?: string;
		password?: string;
	}

	interface redisCacheOpts {
		useLocalCache?: boolean;
		logOnLocalWrite?: boolean;
		logger?: Partial<Console>;
	}

	interface getRedisOpts {
		/**
		 * function to parse when value is fetched from redis
		 */
		parse?: (val: any) => Promise<any> | any;
	}

	interface setRedisOpts extends getRedisOpts{
		/**
		 * in ms / timestring ('1d 3h') default: 0
		 */
		ttl?: number | string;
	}

	/**
	 * Helpers for requiring global & other files
	 */
	namespace Require {
		/**
		 * Resolve path of a global module
		 * @param moduleName
		 */
		function resolveGlobal(moduleName: string): string;

		/**
		 * Resolve path of a local or global module
		 * @param moduleName
		 * @param options
		 * @param options.useNative Use local module if available
		 */
		function resolve(moduleName: string, options?: resolve_options): string;

		/**
		 * Require a module from local or global
		 * @param moduleName
		 * @param options
		 * @param options.useNative Use local module if available
		 */
		function requireModule(moduleName: string, options?: resolve_options): any;

		/**
		 * Require a global module
		 * @param moduleName
		 */
		function requireGlobal(moduleName: string): any;

		const global: typeof requireGlobal;

		const require: typeof requireModule;

	}

	interface resolve_options {
		/**
		 * Use local module if available
		 */
		useNative?: boolean;
	}

	/**
	 * String utilities
	 */
	namespace Str {
		/**
		 * Inverts the case of a string
		 * @param str
		 */
		function invertCase(str: string): string;

		/**
		 * is the character given is a vowel?
		 * @param char
		 */
		function isVowel(char: string): boolean;

		/**
		 * is the character given is a consonant?
		 * @param char
		 */
		function isConsonant(char: string): boolean;

		/**
		 * Get the plural of a string
		 * @param str
		 */
		function plural(str: string): string;

		/**
		 * Pluralize a character if the count is greater than 1
		 * @param str
		 * @param count
		 */
		function pluralize(str: string, count?: number): string;

		/**
		 * transform a string by replacing characters from from string to to string
		 * @param str string to transform
		 * @param from characters to replace in the string
		 * @param to characters to replace with in the string
		 */
		function transform(str: string, from: string, to: string): string;

		/**
		 * Break String From Next Given Character After A Given Position
		 * @param str
		 * @param pos
		 * @param char
		 */
		function trimToNext(str: string, pos: number, char?: string): string;

		/**
		 * Format a number according to a particular locale
		 * Similar to Number.toLocaleFormat, except being significantly faster
		 * @param number the number to format
		 * @param options string of locale or options object {locale: 'en', decimals: 0}
		 */
		function numberFormat(number: number, options?: numberFormatOpts | string): string;

		/**
		 * Space clean a string
		 * Converts consecutive multiple spaces / tabs / newlines in the string into a single space
		 * @param str
		 */
		function spaceClean(str: string): string;

		/**
		 * Rotate a string by 13 characters
		 * @param str the string to be rotated
		 */
		function rot13(str: string): string;

		/**
		 * Rotate a string by 47 characters
		 * @param str the string to be rotated
		 */
		function rot47(str: string): string;

		/**
		 * Parses a json string, returns null if string is invalid (instead of throwing error)
		 * If the input is not a string (already parsed), returns the input itself
		 * @param str
		 */
		function tryParseJson(str: string): any | null;

		/**
		 * Stringifies an object only if it is not already a string
		 * If it is already a string returns the string itself
		 * If it is undefined, returns 'null'
		 * @param obj
		 */
		function tryStringifyJson(obj: any): string;

		/**
		 * Strip html tags from a string
		 * @param str the string to remove tags from
		 * @param options object containing:
		 *	allowed: array of allowed tags eg. ['p', 'b', 'span'], default: []
		 *	blocked: array of blocked tags eg. ['p'], default: []
		 *	replaceWith: replace the removed tags with this string, default: ''
		 *
		 *	if allowed is not given and blocked is given
		 *	then by default all tags not mentioned in blocked are allowed
		 */
		function stripTags(str: string, options: object): string;

		/**
		 * Escape a string for including in regular expressions
		 * @param str string to escape
		 */
		function escapeRegex(str: string): string;

		/**
		 * Convert a number into words
		 * @param number
		 */
		function numberToWords(number: number): string;
	}

	interface numberFormatOpts {
		/**
		 * like 'en-IN'
		 */
		locale?: string;
		/**
		 * like 'INR'
		 */
		currency?: string;
		/**
		 * number of decimal places to return
		 */
		decimals?: number;
	}

	/**
	 * System and process utilities
	 */
	namespace System {
		/**
		 * Execute the given command in a shell.
		 * @param command
		 * @param options options object
		 *	options: {timeout (in ms), cwd, uid, gid, env (object), shell (eg. /bin/sh), encoding}
		*/
		function exec(command: string, options: object): Promise<processObject>;

		/**
		 * Similar to exec but instead executes a given file
		 * @param args
		 */
		function execFile(...args: any[]): Promise<processObject>;

		/**
		 * execute a command and return its output
		 * @param args
		 */
		function execOut(...args: any[]): Promise<string>;

		/**
		 * execute a file and return its output
		 * @param args
		 */
		function execFileOut(...args: any[]): Promise<string>;

		/**
		 * turn off umask for the current process
		 */
		function noUmask(): number;

		/**
		 * restores (turns on) the previous umask
		 */
		function yesUmask(): number;

		/**
		 * get the uid of the user running current process
		 */
		function getuid(): number;

		/**
		 * get user info from username or uid
		 * currently gets user info from /etc/passwd
		 * @param user username or uid
		 */
		function getUserInfo(user: string | number): Promise<object>;

		/**
		 * get all users in the system
		 * currently gets user info from /etc/passwd
		 */
		function getAllUsers(): Promise<{[username: string]: object}>;

		/**
		 * get current time in seconds
		 */
		function time(): number;

		/**
		 * get current time in milliseconds (as double)
		 */
		function millitime(): number;

		/**
		 * get current time in nanoseconds (as double)
		 */
		function nanotime(): number;

		/**
		 * get current time in microseconds (as double)
		 */
		function microtime(): number;

		/**
		 * Sleep for a specified time (in milliseconds)
		 * Example: await System.sleep(2000);
		 */
		function sleep(): Promise<void>;

		/**
		 * wait till the next event loop cycle
		 * this function is useful if we are running a long blocking task
		 * and need to make sure that other callbacks can complete.
		 */
		function tick(): Promise<void>;

		/**
		 * exit and kill the process gracefully (after completing all onExit handlers)
		 * code can be an exit code or a message (string)
		 * if a message is given then it will be logged to console before exiting
		 * @param code exit code or the message to be logged
		 */
		function exit(code: number | string): never;

		/**
		 * force exit the process
		 * no onExit handler will run when force exiting a process
		 * same as original process.exit (which we override)
		 * @param code exit code or the message to be logged
		 */
		function forceExit(code: number | string): never;

		/**
		 * Add an exit handler that runs when process receives an exit signal
		 * callback can be an async function, process will exit when all handlers have completed
		 * @param callback function to call on exit
		 * @param options can be {timeout} or a number
		 */
		function onExit(callback: Function, options?: number | timeoutOpts): Promise<void>;

		/**
		 * install graceful server exit handler on a tcp server
		 * this will make sure that the process exits only
		 * after all the current requests are served
		 * @param server
		 * @param options
		 */
		function gracefulServerExit(server: any, options?: number | timeoutOpts): void;

		/**
		 * set the max memory that the current node process can use
		 * @param memory max memory in megabytes
		 */
		function setMaxMemory(memory: number): void;

		/**
		 * get the current git branch name (in cwd)
		 * @returns the current branch name, empty string if not found
		 */
		function getGitBranch(): Promise<string>;
	}

	interface processObject {
		childProcess: ChildProcess;
		stdout: Buffer;
		stderr: Buffer;
	}

	interface timeoutOpts {
		/**
		 * Milliseconds before timing out (default 10000)
		 */
		timeout?: number;
	}

	interface vachanOptions {
		silent?: boolean;
	}

	/**
	 * Promise utility functions
	 */
	class Vachan {
		/**
		 * Promise utility functions
		 */
		constructor();

		/**
		 * identity function is to make sure returned value is a promise.
		 * returns the following if the input is a:
		 * - promise: returns the promise itself
		 * - function: executes the function and returns the result wrapped in a promise
		 * - any: returns the input wrapped in a promise
		 * @param promise
		 */
		static identity<T>(promise: T | Promise<T> | (() => T | Promise<T>)): Promise<T>;

		/**
		 * Execute a promise / function, and exit when it completes
		 * @param promise
		 * @param options
		 */
		static exit(promise: Promise<any> | Function, options?: vachanOptions): never;

		/**
		 * Execute a promise / function, without caring about its results
		 * @param promise
		 * @param options
		 */
		static exec(promise: Promise<any> | Function, options: vachanOptions): void;

		/**
		 * create a lazy promise from an executor function ((resolve, reject) => {})
		 * a lazy promise defers execution till .then() or .catch() is called
		 * @param executor function(resolve, reject) {}, same as promise constructor
		 */
		static lazy<T>(executor: (resolve: (val: T) => void, reject: (reason: Error) => void) => void): Promise<T>;

		/**
		 * create a lazy promise from an async function
		 * a lazy promise defers execution till .then() or .catch() is called
		 */
		static lazyFrom<T>(asyncFunction: () => T | Promise<T>): Promise<T>;

		/**
		 * Returns a promise that resolves after the specified duration
		 * Can be used to delay / sleep
		 * Example: await Vachan.sleep(2000);
		 * @param duration milliseconds to delay for
		 */
		static sleep(duration: number): Promise<void>;

		/**
		 * Promise.finally polyfill
		 * Invoked when the promise is settled regardless of outcome
		 * @see https://github.com/sindresorhus/p-finally
		 * @param promise
		 * @param onFinally
		 */
		static finally<T>(promise: Promise<T>, onFinally: () => void): Promise<T>;

		/**
		 * Returns a promise the rejects on specified timeout
		 * @param promise A Promise or an async function
		 * @param options can be {timeout} or a number
		 *	timeout: Milliseconds before timing out
		*/
		static timeout<T>(promise: T | Promise<T> | (() => T | Promise<T>), options: {timeout?: number} | number): Promise<T>;

		/**
		 * Returns a Promise that resolves when condition returns true.
		 * Rejects if condition throws or returns a Promise that rejects.
		 * @see https://github.com/sindresorhus/p-wait-for
		 * @param conditionFn function that returns a boolean
		 * @param options can be {interval, timeout} or a number
		 * @param options.interval: Number of milliseconds to wait before retrying condition (default 50)
		 * @param options.timeout: will reject the promise on timeout (in ms)
		 */
		static waitFor(conditionFn: () => boolean | Promise<boolean>, options?: {interval?: number, timeout?: number} | number): Promise<void>;

		/**
		 * Returns an async function that delays calling fn
		 * until after wait milliseconds have elapsed since the last time it was called
		 * @see https://github.com/sindresorhus/p-debounce
		 * @param fn function to debounce
		 * @param delay ms to wait before calling fn.
		 * @param options object of {leading, fixed}
		 * @param options.leading: (default false)
		 *	Call the fn on the leading edge of the timeout.
		*	Meaning immediately, instead of waiting for wait milliseconds.
		* @param options.fixed: fixed delay, each call won't reset the timer to 0
		*/
		static debounce<T, U extends any[]>(fn: (...args: U) => T, delay: number, options?: {leading?: boolean, fixed?: boolean}): (...args: U) => Promise<T>;

		/**
		 * Returns a Promise that is fulfilled when all promises in input
		 * and ones returned from mapper are fulfilled, or rejects if any
		 * of the promises reject. The fulfilled value is an Array of the
		 * fulfilled values returned from mapper in input order.
		 * @param iterable collection to iterate over
		 * @param mapper The function invoked per iteration, should return a promise
		 *	mapper is invoked with (value, index|key, iterable)
		* @param options object of {concurrency}
		*	concurrency: Number of maximum concurrently running promises, default is Infinity
		*/
		static map<T, U>(iterable: Iterable<T>, mapper: (value?: T, index?: number | string, iterable?: Iterable<T>) => U, options?: {concurrency: number}): Promise<U[]>;
		static map<T, U>(iterable: {[key: string]: T}, mapper: (value?: T, index?: string, iterable?: {[key: string]: T}) => U, options?: {concurrency: number}): Promise<U[]>;
		/**
		 * Like promiseMap but for keys
		 * @param iterable
		 * @param mapper
		 * @param options
		 */
		static mapKeys<T>(iterable: Iterable<T>, mapper: (value?: T, key?: number | string, iterable?: Iterable<T>) => string, options?: {concurrency: number}): Promise<{[key: string]: T}>;
		static mapKeys<T>(iterable: {[key: string]: T}, mapper: (value?: T, key?: number | string, iterable?: {[key: string]: T}) => string, options?: {concurrency: number}): Promise<{[key: string]: T}>;

		/**
		 * Like promiseMap but for values
		 * @param iterable
		 * @param mapper
		 * @param options
		 */
		static mapValues<T, U>(iterable: Iterable<T>, mapper: (value?: T, key?: number | string, iterable?: Iterable<T>) => U, options?: {concurrency: number}): Promise<{[key: string]: U}>;
		static mapValues<T, U>(iterable: {[key: string]: T}, mapper: (value?: T, key?: string, iterable?: {[key: string]: T}) => U, options?: {concurrency: number}): Promise<{[key: string]: U}>;
	}

	namespace cfg {
		/**
		 *
		 * @param key
		 * @param defaultValue
		 */
		function get<T = any>(key: string, defaultValue: T): Readonly<T>;

		/**
		 * Get the whole config object
		 * Is not immutable, so don't write anything to it
		 */
		function _getConfig(): Readonly<any>;

		/**
		 * set values in global config
		 * return previous value
		 */
		function set(key: string, value: any): any;

		/**
		 * @param key an object to assign all key values from it
		 * @param value 
		 */
		function set(key: {[key: string]: any}): null;
		/**
		 * set values in global config with an object to assign all key values from it
		 * if a key already exists then it is merged with new value
		 * if obj is not an Object then nothing happens
		 */
		function merge(obj: {[key: string]: any}): null;

		/**
		 * set values in global config with an object to assign all key values from it
		 * if a key already exists then it is assigned with new value
		 * if obj is not an Object then nothing happens
		 */
		function assign(obj: {[key: string]: any}): null;

		// FIXME: Illegal function name 'delete' can't be used here
		// delete: (key: string) => void;

		/**
		 * read config from a file, and merge with existing config
		 * @param file path of the file to read (only absolute paths)
		 * @param options
		 * @param options.ignoreErrors ignore all errors
		 * @param options.ignoreNotFound ignore if file not found
		 * @param options.overwrite Overwrite config not merge
		 */
		function file(file: string, options?: {ignoreErrors?: boolean, ignoreNotFound?: boolean, overwrite?: boolean}): void;

		/**
		 * read the file specified by the key, and then cache it
		 * @param key
		 */
		function read(key: string): any;

		function getEnv(): string;

		function env(): string;

		function isProduction(): boolean;
		function is_production(): boolean;
		function isProd(): boolean;
		function is_prod(): boolean;

		function isStaging(): boolean;
		function is_staging(): boolean;

		/**
		 * Returns true if env is production or staging
		 */
		function isProductionLike(): boolean;
		function isProdLike(): boolean;

		function isTest(): boolean;
		function is_test(): boolean;

		/**
		 * returns true in environments not 'staging' or 'production'
		 */
		function isDev(): boolean;
		function isDevelopment(): boolean;
		function is_dev(): boolean;

	}

	/**
	 * Reads a config value
	 * @param key key to read, can be nested like `a.b.c`
	 * @param defaultValue value to return if key is not found
	 */
	function cfg<T = any>(key: string, defaultValue?: T): Readonly<T>

	const crypt: typeof Crypt;

	const system: typeof System;

	const baseConvert: typeof Crypt.baseConvert;
}
