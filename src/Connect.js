import path from 'path';
import _ from 'lodash';
import got from 'got';
import {CookieJar} from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import SocksHTTPAgent from 'sm-socks5-http-client/lib/Agent';
import SocksHTTPSAgent from 'socks5-https-client/lib/Agent';
import File from './File';
import Crypt from './Crypt';

const userAgents = {
	chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3163.100 Safari/537.36',
	edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393',
	firefox: 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:63.0) Gecko/20100101 Firefox/63.0',
	ie: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
	operaMini: 'Opera/9.80 (Android; Opera Mini/8.0.1807/36.1609; U; en) Presto/2.12.423 Version/12.16',
	googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	googlebotMobile: '​Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	android: 'Mozilla/5.0 (Linux; Android 8.0.0; ONEPLUS A3003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.80 Mobile Safari/537.36',
	iphone: 'Mozilla/6.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/8.0 Mobile/10A5376e Safari/8536.25',
	ipad: 'Mozilla/5.0 (iPad; CPU OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.0.2 Mobile/9A5248d Safari/6533.18.5',
};

userAgents.windows = userAgents.chrome;
userAgents.safariMobile = userAgents.iphone;
userAgents.chromeMobile = userAgents.android;
userAgents.desktop = userAgents.chrome;
userAgents.mobile = userAgents.android;
userAgents.tablet = userAgents.ipad;

function socksAgent(options) {
	return {
		http: new SocksHTTPAgent(options),
		https: new SocksHTTPSAgent(options),
	};
}

/**
 * Returns proxy url based on the proxy options.
 *
 * @param  {object} proxy proxy options
 * @return {string} proxy url based on the options
 * @private
 */
function makeProxyUrl(proxy) {
	let url = proxy.address.replace('http://', '');
	if (proxy.port) {
		url = url.split(':')[0] + ':' + proxy.port;
	}
	if (proxy.auth && proxy.auth.username) {
		url = `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password)}@${url}`;
	}

	return `http://${url}`;
}

/**
 * Simple & Powerful HTTP request client.
 */
class Connect {
	/**
	 * Creates a new Connect object.
	 * @constructor
	 */
	constructor() {
		/**
		 * Timeout period for the request in milliseconds
		 * @private
		 */
		this.requestTimeout = 120 * 1000;
		/**
		 * Various options (or parameters) defining the Connection
		 * @private
		 */
		this.options = {
			// url to send request at
			url: null,
			// method of the request (GET / POST / OPTIONS / DELETE / PATCH / PUT)
			method: 'GET',
			// headers to set
			headers: {
				'User-Agent': userAgents.chrome,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.8',
			},
			// object of cookie values to set
			cookies: {},
			// cookie jar
			cookieJar: null,
			// whether to follow redirects
			followRedirect: true,
			// maximum number of redirects to follow
			maxRedirects: 6,
			// whether to ask for gzip response
			gzip: true,
			// whether to return the result as a stream
			stream: false,
			// timeout of the request
			timeout: 120 * 1000,
			// whether to verify ssl certificate
			strictSSL: false,
			// proxy details (should be {address, port, type, auth: {username, password}})
			proxy: {},
			// post fields (or query params in case of GET)
			fields: {},
			// query params
			query: {},
			// encoding of the response, if null body is returned as buffer
			encoding: 'utf8',
			// body of the request (valid in case of POST / PUT / PATCH)
			body: '',
			// custom http & https agent (should be {http: agent, https: agent})
			agent: null,
			// http authentication (should be {username, password})
			auth: null,
		};
	}

	/**
	 * Set the url for the connection.
	 *
	 * @param {string} url
	 * @return {Connect} self
	 */
	url(url) {
		this.options.url = url;
		return this;
	}

	/**
	 * @static
	 * Creates and returns a new Connect object with the given url.
	 *
	 * @param {string} url
	 * @return {Connect} A new Connect object with url set to the given url
	 */
	static url(url) {
		const connect = new this();
		connect.url(url);
		return connect;
	}

	/**
	 * @static
	 * Returns a new cookie jar.
	 * @param {Array<any>} args
	 * @return {CookieJar} A cookie jar
	 */
	static newCookieJar(...args) {
		return new CookieJar(...args);
	}

	static _getGlobalCookieJar() {
		if (!this._globalCookieJar) {
			this._globalCookieJar = this.newCookieJar();
		}
		return this._globalCookieJar;
	}

	/**
	 * Set or unset the followRedirect option for the connection.
	 *
	 * @param {boolean} shouldFollowRedirect boolean representing whether to follow redirect or not
	 * @return {Connect} self
	 */
	followRedirect(shouldFollowRedirect = true) {
		this.options.followRedirect = shouldFollowRedirect;
		return this;
	}

	/**
	 * Set the number of maximum redirects to follow
	 * @param {number} numRedirects max number of redirects
	 */
	maxRedirects(numRedirects) {
		this.options.maxRedirects = numRedirects;
		return this;
	}

	/**
	 * Set value of a header parameter for the connection.
	 *
	 * @param {string|object} headerName name of the header parameter whose value is to be set
	 * @param {string|undefined} headerValue value to be set
	 * @return {Connect} self
	 */
	header(headerName, headerValue) {
		if (typeof headerName === 'string') {
			this.options.headers[headerName] = headerValue;
		}
		else {
			Object.assign(this.options.headers, headerName);
		}

		return this;
	}

	/**
	 * Set value of the headers for the connection.
	 *
	 * @param {object} headers object representing the headers for the connection
	 * @return {Connect} self
	 */
	headers(headers) {
		Object.assign(this.options.headers, headers);
		return this;
	}

	/**
	 * Set the body of the connection object.
	 *
	 * @param {any} body value for body
	 *  if body is an object, contentType will be set to application/json and body will be stringified
	 * @param {string} [contentType=null] string representing the content type of the body
	 *  contentType can be null or json
	 * @return {Connect} self
	 */
	body(body, contentType = null) {
		if (contentType === 'json') {
			this.contentType('json');
		}

		this.options.body = body;
		return this;
	}

	/**
	 * Set the 'Referer' field in the headers.
	 *
	 * @param {string} referer referer value
	 * @return {Connect}
	 */
	referer(referer) {
		this.header('Referer', referer);
		return this;
	}

	/**
	 * Set the 'User-Agent' field in the headers.
	 * can be either name of the browser / platform or full user agent
	 * name can be:
	 *  chrome, firefox, ie, edge, safari, googlebot
	 *  chromeMobile, safariMobile, googlebotMobile, operaMini
	 *  windows, android, iphone, ipad, desktop, mobile, tablet
	 *
	 * @param {string} userAgent name of the user-agent or its value
	 * @return {Connect} self
	 */
	userAgent(userAgent) {
		this.header('User-Agent', userAgents[userAgent] || userAgent);
		return this;
	}

	/**
	 * Set the 'Content-Type' field in the headers.
	 *
	 * @param  {string} contentType value for content-type
	 * @return {Connect}
	 */
	contentType(contentType) {
		if (contentType === 'json') {
			this.header('Content-Type', 'application/json');
		}
		else if (contentType === 'form') {
			this.header('Content-Type', 'application/x-www-form-urlencoded');
		}
		else {
			this.header('Content-Type', contentType);
		}

		return this;
	}

	/**
	 * Returns whether the content-type is JSON or not
	 *
	 * @return {boolean} true, if content-type is JSON; false, otherwise
	 */
	isJSON() {
		return this.options.headers['Content-Type'] === 'application/json';
	}

	/**
	 * Returns whether the content-type is Form or not
	 *
	 * @return {boolean} true, if content-type is JSON; false, otherwise
	 */
	isForm() {
		return this.options.headers['Content-Type'] === 'application/x-www-form-urlencoded';
	}

	/**
	 * Sets the value of a cookie.
	 * Can be used to enable global cookies, if cookieName is set to true
	 * and cookieValue is undefined (or is not passed as an argument).
	 * Can also be used to set multiple cookies by passing in an object
	 * representing the cookies and their values as key:value pairs.
	 *
	 * @param {string|boolean|object} cookieName  represents the name of the
	 * cookie to be set, or the cookies object
	 * @param {string|undefined} [cookieValue] cookie value to be set
	 * @return {Connect} self
	 */
	cookie(cookieName, cookieValue) {
		if (cookieName === true && cookieValue === undefined) {
			this.globalCookies();
		}
		if (typeof cookieName === 'string') {
			this.options.cookies[cookieName] = cookieValue;
		}
		else {
			Object.assign(this.options.cookies, cookieName);
		}

		return this;
	}

	/**
	 * Sets multiple cookies.
	 * Can be used to enable global cookies, if cookies is set to true.
	 *
	 * @param {object|boolean} cookies object representing the cookies
	 * and their values as key:value pairs.
	 * @return {Connect} self
	 */
	cookies(cookies) {
		if (cookies === true) {
			this.globalCookies();
		}
		else {
			Object.assign(this.options.cookies, cookies);
		}

		return this;
	}

	/**
	 * Enable global cookies.
	 *
	 * @param {boolean} [enableGlobalCookies=true]
	 * @return {Connect} self
	 */
	globalCookies(enableGlobalCookies = true) {
		if (enableGlobalCookies) {
			this.options.cookieJar = this.constructor._getGlobalCookieJar();
		}

		return this;
	}

	/**
	 * Set the value of cookie jar based on a file (cookie store).
	 *
	 * @param  {string} fileName name of (or path to) the file
	 * @return {Connect}         self
	 */
	cookieFile(fileName) {
		const cookieJar = this.constructor.newCookieJar(new FileCookieStore(fileName));
		this.options.cookieJar = cookieJar;
		return this;
	}

	/**
	 * Set the value of cookie jar.
	 *
	 * @param  {CookieJar} cookieJar value to be set
	 * @return {Connect}             self
	 */
	cookieJar(cookieJar) {
		this.options.cookieJar = cookieJar;
		return this;
	}

	/**
	 * Set request timeout.
	 *
	 * @param  {number} timeout timeout value in seconds
	 * @return {Connect} self
	 */
	timeout(timeout) {
		this.options.timeout = timeout * 1000;
		return this;
	}

	/**
	 * Set request timeout.
	 *
	 * @param  {number} timeoutInMs timeout value in milliseconds
	 * @return {Connect}            self
	 */
	timeoutMs(timeoutInMs) {
		this.options.timeout = timeoutInMs;
		return this;
	}

	/**
	 * alias for timeoutMs
	 * @param {number} timeoutInMs
	 * @return {Connect}
	 */
	timeoutMilli(timeoutInMs) {
		return this.timeoutMs(timeoutInMs);
	}

	/**
	 * Set value of a field in the options.
	 * Can also be used to set multiple fields by passing in an object
	 * representing the field-names and their values as key:value pairs.
	 *
	 * @param  {string|object} fieldName name of the field to be set, or the fields object
	 * @param  {*} [fieldValue] value to be set
	 * @return {Connect} self
	 */
	field(fieldName, fieldValue) {
		if (typeof fieldName === 'string') {
			this.options.fields[fieldName] = fieldValue;
		}
		else {
			Object.assign(this.options.fields, fieldName);
		}

		return this;
	}

	/**
	 * Set multiple fields.
	 *
	 * @param {object} fields object representing the field-names and their
	 *  values as key:value pairs
	 * @return {Connect} self
	 */
	fields(fields) {
		Object.assign(this.options.fields, fields);
		return this;
	}

	/**
	 * Set the request method for the connection.
	 *
	 * @param {string} method one of the HTTP request methods ('GET', 'PUT', 'POST', etc.)
	 * @return {Connect} self
	 */
	method(method) {
		this.options.method = (method || 'GET').toUpperCase();
		return this;
	}

	/**
	 * @typedef {object} auth
	 * @property {string} username
	 * @property {string} password
	 */

	/**
	 * Set username and password for authentication.
	 *
	 * @param {string | auth} username
	 * @param {string} password
	 * @return {Connect} self
	 */
	httpAuth(username, password) {
		if (typeof username === 'string') {
			// username & password are strings
			this.options.auth = {
				username,
				password,
			};
		}
		else if (username.username) {
			// username argument is an object of {username, password}
			this.options.auth = username;
		}

		return this;
	}

	/**
	 * Set proxy address (or options).
	 *
	 * @param {string|object} proxy proxy address, or object representing proxy options
	 * @return {Connect} self
	 */
	proxy(proxy) {
		// actual proxy is added at the end using _addProxy
		// this is because we need the url (http or https) to add the proxy
		// and url might be added after this method
		if (typeof proxy === 'string') {
			Object.assign(this.options.proxy, {
				address: proxy,
				port: null,
				type: 'http',
			});
		}
		else {
			this.options.proxy = proxy;
		}

		return this;
	}

	/**
	 * Set address and port for an http proxy.
	 *
	 * @param {string} proxyAddress
	 * @param {number} proxyPort
	 * @return {Connect} self
	 */
	httpProxy(proxyAddress, proxyPort) {
		Object.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'http',
		});

		return this;
	}

	/**
	 * Set address and port for a socks proxy.
	 *
	 * @param {string} proxyAddress
	 * @param {number} proxyPort
	 * @return {Connect} self
	 */
	socksProxy(proxyAddress, proxyPort) {
		Object.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'socks',
		});

		return this;
	}

	/**
	 * Set username and password for proxy.
	 *
	 * @param {string} username
	 * @param {string} password
	 * @return {Connect} self
	 */
	proxyAuth(username, password) {
		if (typeof username === 'string') {
			// username & password are strings
			this.options.proxy.auth = {
				username,
				password,
			};
		}
		else if (username.username) {
			// username argument is an object of {username, password}
			this.options.proxy.auth = username;
		}

		return this;
	}

	/**
	 * Set request method to 'GET'.
	 *
	 * @return {Connect} self
	 */
	get() {
		this.method('GET');
		return this;
	}

	/**
	 * Set request method to 'POST'.
	 *
	 * @return {Connect} self
	 */
	post() {
		this.method('POST');
		return this;
	}

	/**
	 * Set request method to 'PUT'.
	 *
	 * @return {Connect} self
	 */
	put() {
		this.method('PUT');
		return this;
	}

	/**
	 * Set cache directory for the connection.
	 *
	 * @param {string} dir name or path to the directory
	 * @return {Connect} self
	 */
	cacheDir(dir) {
		this.resposeCacheDir = dir;
		return this;
	}

	/**
	 * Set if the body is to be returned as a buffer
	 *
	 * @param {boolean} [returnAsBuffer=true]
	 * @return {Connect} self
	 */
	asBuffer(returnAsBuffer = true) {
		if (returnAsBuffer) {
			this.options.encoding = null;
		}
		else if (this.options.encoding === null) {
			this.options.encoding = 'utf8';
		}
		return this;
	}

	/**
	 * Set the path for file for saving the response.
	 *
	 * @param  {string} filePath
	 * @return {Connect}         self
	 */
	save(filePath) {
		// get response as buffer
		this.asBuffer();
		this.saveFilePath = filePath;
		return this;
	}

	/**
	 * Add proxy based on the proxy options. Proxy is added,
	 * if and only if proxy address has been previously set.
	 * If no proxy type is previously set, 'http' is taken as
	 * the default proxy type.
	 *
	 * NOTE: This function is for internal use
	 * @private
	 */
	_addProxy() {
		const proxy = this.options.proxy;
		if (!proxy) return;
		if (typeof proxy === 'string') return;

		this.options.proxy = null;
		if (!proxy.address) return;

		const proxyType = proxy.type || 'http';

		if (proxyType === 'http' || proxyType === 'https') {
			this.options.proxy = makeProxyUrl(proxy);
		}
		else if (proxyType === 'socks' || proxyType === 'socks5') {
			const agentOptions = {};
			agentOptions.socksHost = proxy.address.split(':')[0];
			agentOptions.socksPort = proxy.port || proxy.address.split(':')[1] || 1080;
			if (proxy.auth && proxy.auth.username) {
				agentOptions.socksUsername = proxy.auth.username;
				agentOptions.socksPassword = proxy.auth.password;
			}

			this.options.agent = socksAgent(agentOptions);
		}
	}

	/**
	 * Add the options 'fields' to the options body, form or qs
	 * on the basis of the request method.
	 *
	 * NOTE: This function is for internal use
	 * @private
	 */
	_addFields() {
		const hasBody = ['POST', 'PUT', 'PATCH'].includes(this.options.method);

		if (!this.options.body) {
			if (_.isEmpty(this.options.fields)) {
				return;
			}

			this.options.body = this.options.fields;
			if (hasBody && !this.options.headers['Content-Type']) {
				this.contentType('form');
			}
		}
		else if (_.isPlainObject(this.options.body)) {
			Object.assign(this.options.body, this.options.fields);
			if (hasBody && !this.options.headers['Content-Type']) {
				this.contentType('json');
			}
		}

		if (hasBody) {
			if (this.isJSON()) {
				if (typeof this.options.body === 'object') {
					this.options.body = JSON.stringify(this.options.fields);
				}
			}
		}
		else {
			this.options.query = this.options.query || {};
			Object.assign(this.options.query, this.options.body);
		}
	}

	/**
	 * Add cookies in the options to the header.
	 *
	 * NOTE: This function is for internal use
	 * @private
	 */
	_addCookies() {
		if (!this.options.cookies) return;

		const cookies = [];
		_.forEach(this.options.cookies, (value, key) => {
			cookies.push(`${key}=${value}`);
		});

		if (cookies.length) {
			this.header('Cookie', cookies.join('; '));
		}
	}

	/**
	 * get options for underlying library (got)
	 * @private
	 */
	_getOptions() {
		const options = {
			throwHttpErrors: false,
			agent: this.options.agent,
			decompress: this.options.gzip,
			followRedirect: this.options.followRedirect,
			timeout: this.options.timeout,
			form: this.isForm(),
			encoding: this.options.encoding,
			body: this.options.body,
			headers: this.options.headers,
			method: this.options.method,
			cookieJar: this.options.cookieJar,
			// max redirects not supported
		};

		return options;
	}

	async _readCache() {
		if (!this.resposeCacheDir) {
			return this._makeFetchPromise(null);
		}

		const cacheKey = Crypt.md5(
			JSON.stringify(_.pick(this.options, ['url', 'method', 'fields', 'body']))
		);

		const cacheFilePath = path.join(this.resposeCacheDir, cacheKey);
		try {
			const contents = File(cacheFilePath).read();
			const response = {
				body: contents,
				statusCode: 200,
				status: 200,
				url: this.options.url,
				timeTaken: 0,
				cached: true,
			};

			return response;
		}
		catch (e) {
			// Ignore Errors
			return this._makeFetchPromise(cacheFilePath);
		}
	}

	async _writeCache(response, cacheFilePath) {
		const promises = [];

		if (this.saveFilePath) {
			promises.push(File(this.saveFilePath).write(response.body));
		}
		if (cacheFilePath && response.statusCode === 200) {
			promises.push(File(cacheFilePath).write(response.body));
		}

		if (promises.length) {
			await Promise.all(promises);
		}
	}


	/**
	 * It resolves or rejects the promise object. It is
	 * used by fetch() to make the promise.
	 *
	 * NOTE: This function is for internal use
	 * @private
	 */
	async _makeFetchPromise(cacheFilePath) {
		this._addProxy();
		this._addFields();
		this._addCookies();

		const options = this._getOptions();

		const startTime = Date.now();
		try {
			const response = await got(this.options.url, options);

			const status = response.statusCode;
			if (status === 407) {
				const e = new Error('407 Proxy Authentication Required');
				e.code = 'EPROXYAUTH';
				e.timeTaken = Date.now() - startTime;
				throw e;
			}

			// already supported by got
			// response.url = response.request.uri.href || this.options.url;
			// already supported by got
			// response.requestUrl = this.options.url;
			response.timeTaken = Date.now() - startTime;
			response.cached = false;
			response.status = status;

			await this._writeCache(response, cacheFilePath);
			return response;
		}
		catch (e) {
			if (e instanceof got.TimeoutError) {
				const err = new Error('Request Timed Out');
				err.code = 'ETIMEDOUT';
				err.timeTaken = Date.now() - startTime;
				throw e;
			}

			throw e;
		}
	}

	/**
	 * @typedef {object} response
	 * @property {string} body the actual response body
	 * @property {string} url the final url downloaded after following all redirects
	 * @property {number} timeTaken time taken (in ms) for the request
	 * @property {boolean} cached false if the response was downloaded, true if returned from a cache
	 * @property {number} statusCode
	 */

	/**
	 * It creates and returns a promise based on the information
	 * passed to and parameters of this object.
	 *
	 * @return {Promise<response>} a promise that resolves to response
	 */
	async fetch() {
		if (!this.promise) {
			this.promise = this._readCache();
		}
		return this.promise;
	}

	/**
	 * It is used for method chaining.
	 *
	 * @template T
	 * @param  {(res: response) => T} successCallback To be called if the Promise is fulfilled
	 * @param  {(err: Error) => T} [errorCallback] function to be called if the Promise is rejected
	 * @return {Promise<T>} a Promise in pending state
	 */
	async then(successCallback, errorCallback) {
		return this.fetch().then(successCallback, errorCallback);
	}

	/**
	 * It is also used for method chaining, but handles rejected cases only.
	 *
	 * @template T
	 * @param  {(err: Error) => T} errorCallback function to be called if the Promise is rejected
	 * @return {Promise<T>} a Promise in pending state
	 */
	async catch(errorCallback) {
		return this.fetch().catch(errorCallback);
	}
}

export default Connect;
