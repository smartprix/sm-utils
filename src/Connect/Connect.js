import path from 'path';
import util from 'util';
import {URL, URLSearchParams} from 'url';
import _ from 'lodash';
import got from 'got';
import {CookieJar} from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import {
	httpAgent as socksHttpAgent,
	httpsAgent as socksHttpsAgent,
} from './socksProxyAgent';
import {
	httpAgent as proxyHttpAgent,
	httpsAgent as proxyHttpsAgent,
} from './httpProxyAgent';
import File from '../File';
import Crypt from '../Crypt';

CookieJar.prototype.getCookiesAsync = util.promisify(CookieJar.prototype.getCookies);
CookieJar.prototype.setCookieAsync = util.promisify(CookieJar.prototype.setCookie);

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

const getMethodRedirectCodes = new Set([300, 301, 302, 303, 304, 305, 307, 308]);
const allMethodRedirectCodes = new Set([300, 303, 307, 308]);

/**
 * Returns proxy url based on the proxy options.
 *
 * @param  {object} proxy proxy options
 * @return {string} proxy url based on the options
 * @private
 */
// eslint-disable-next-line no-unused-vars
function makeProxyUrl(proxy) {
	let url = `${proxy.host}:${proxy.port}`;
	if (proxy.auth && proxy.auth.username) {
		url = `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password)}@${url}`;
	}

	if (proxy.type === 'socks' || proxy.type === 'socks5') {
		return `socks5://${url}`;
	}

	return `http://${url}`;
}

function httpProxyAgent(options) {
	return {
		http: proxyHttpAgent(options),
		https: proxyHttpsAgent(options),
	};
}

function socksProxyAgent(options) {
	return {
		http: socksHttpAgent(options),
		https: socksHttpsAgent(options),
	};
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
		this.id = Math.random().toString(10).substring(2, 12);

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
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'accept-language': 'en-US,en;q=0.9',
				// set empty cookie header if no cookies exist
				// this is because some sites expect cookie header to be there
				cookie: '',
			},
			// object of cookie values to set
			cookies: {},
			// cookie jar
			cookieJar: null,
			// whether to follow redirects
			followRedirect: true,
			// maximum number of redirects to follow
			maxRedirects: 6,
			// whether to ask for compressed response (automatically handles accept-encoding)
			compress: true,
			// whether to return the result as a stream
			stream: false,
			// timeout of the request
			timeout: 120 * 1000,
			// whether to verify ssl certificate
			strictSSL: false,
			// proxy details (should be {address, port, type, auth: {username, password}})
			// type can be http, https, socks
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
		};

		// ask for compressed response by default
		this.compress(true);

		// default user-agent is chrome
		this.userAgent('chrome');
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
	 * Creates and returns a new Connect object (with get method) with the given url.
	 *
	 * @param {string} url
	 * @return {Connect} A new Connect object with url set to the given url
	 */
	static get(url) {
		const connect = new this();
		connect.url(url);
		connect.get();
		return connect;
	}

	/**
	 * @static
	 * Creates and returns a new Connect object (with post method) with the given url.
	 *
	 * @param {string} url
	 * @return {Connect} A new Connect object with url set to the given url
	 */
	static post(url) {
		const connect = new this();
		connect.url(url);
		connect.post();
		return connect;
	}

	/**
	 * @static
	 * Creates and returns a new Connect object (with put method) with the given url.
	 *
	 * @param {string} url
	 * @return {Connect} A new Connect object with url set to the given url
	 */
	static put(url) {
		const connect = new this();
		connect.url(url);
		connect.put();
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
			this.options.headers[headerName.toLowerCase()] = headerValue;
		}
		else {
			Object.assign(
				this.options.headers,
				_.mapKeys(headerName, (val, key) => key.toLowerCase()),
			);
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
		this.header('referer', referer);
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
		const existing = userAgents[userAgent];
		if (existing) {
			this.header('user-agent', `${existing} R/${this.id}`);
		}
		else {
			this.header('user-agent', userAgent);
		}

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
			this.header('content-type', 'application/json');
		}
		else if (contentType === 'form') {
			this.header('content-type', 'application/x-www-form-urlencoded');
		}
		else {
			this.header('content-type', contentType);
		}

		return this;
	}

	/**
	 * Returns whether the content-type is JSON or not
	 *
	 * @return {boolean} true, if content-type is JSON; false, otherwise
	 */
	isJSON() {
		return this.options.headers['content-type'] === 'application/json';
	}

	/**
	 * Returns whether the content-type is Form or not
	 *
	 * @return {boolean} true, if content-type is JSON; false, otherwise
	 */
	isForm() {
		return this.options.headers['content-type'] === 'application/x-www-form-urlencoded';
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
	 * @param {boolean|object} [options=true]
	 * @return {Connect} self
	 */
	globalCookies(options = true) {
		if (options === false || options === null) return this;
		const jar = this.constructor._getGlobalCookieJar();
		if (options === true) {
			this.options.cookieJar = jar;
			return this;
		}
		if (options.readOnly) {
			this.options.readCookieJar = jar;
		}

		return this;
	}

	/**
	 * Set the value of cookie jar based on a file (cookie store).
	 *
	 * @param  {string} fileName name of (or path to) the file
	 * @return {Connect}         self
	 */
	cookieFile(fileName, options = {}) {
		const cookieJar = this.constructor.newCookieJar(new FileCookieStore(fileName));
		this.cookieJar(cookieJar, options);
		return this;
	}

	/**
	 * Set the value of cookie jar.
	 *
	 * @param  {CookieJar} cookieJar value to be set
	 * @return {Connect}             self
	 */
	cookieJar(cookieJar, options = {}) {
		if (options.readOnly) {
			this.options.readCookieJar = cookieJar;
		}
		else {
			this.options.cookieJar = cookieJar;
		}

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
	 * @param {string|object} fieldName name of the field to be set, or the fields object
	 * @param {string|undefined} [fieldValue] value to be set
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
	 * Set value of a query parameter
	 * Can also be used to set multiple query params by passing in an object
	 * representing the param-names and their values as key:value pairs.
	 *
	 * @param {string|object} fieldName name of the field to be set, or the fields object
	 * @param {string|undefined} [fieldValue] value to be set
	 * @return {Connect} self
	 */
	query(name, value) {
		if (typeof name === 'string') {
			this.options.query[name] = value;
		}
		else {
			Object.assign(this.options.query, name);
		}

		return this;
	}

	/**
	 * set whether to ask for compressed response (handles decompression automatically)
	 * @param {boolean} [askForCompression=true] whether to ask for compressed response
	 * @return {Connect} self
	 */
	compress(askForCompression = true) {
		this.options.compress = askForCompression;
		if (askForCompression) {
			// some sites expect an accept-encoding header
			this.header('accept-encoding', '');
		}
		else {
			this.header('accept-encoding', `gzip, deflate, ${this.id}`);
		}
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
	 * @param {string|undefined} password
	 * @return {Connect} self
	 */
	httpAuth(username, password) {
		let auth = '';
		if (typeof username === 'string') {
			if (password === undefined) {
				// username is of the format username:password
				auth = username;
			}
			else {
				// username & password are strings
				auth = `${username}:${password}`;
			}
		}
		else if (username.username) {
			// username argument is an object of {username, password}
			auth = `${username.username}:${username.password}`;
		}

		this.header('authorization', 'Basic ' + Buffer.from(auth).toString('base64'));
		return this;
	}

	/**
	 * Set bearer token for authorization
	 * @param {string} token
	 * @return {Connect} self
	 */
	bearerToken(token) {
		this.header('authorization', `Bearer ${token}`);
		return this;
	}

	/**
	 * Set api token using x-api-token header
	 * @param {string} token
	 * @return {Connect} self
	 */
	apiToken(token) {
		this.header('x-api-token', token);
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
		else if (proxy.host) {
			const proxyCopy = {...proxy};
			if (proxyCopy.host) {
				proxyCopy.address = proxyCopy.host;
				delete proxyCopy.host;
			}
			this.options.proxy = proxyCopy;
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
	 * clone this instance
	 * @returns {Connect} cloned instance
	 */
	clone() {
		const cloned = new Connect();
		cloned.options = _.cloneDeep(this.options);
		return cloned;
	}

	_parseUrl() {
		this._url = this.options.url;
		if (this._url.includes('@')) {
			// parse url and extract http auth
			// got does not accept auth in urls
			const url = new URL(this._url);
			if (url.username) {
				this.httpAuth(url.username, url.password || '');
				url.username = '';
				url.password = '';
				this._url = url.toString();
			}
		}
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
		if (!proxy || !proxy.address) return;

		const proxyType = proxy.type || 'http';
		const proxyOpts = {};
		const address = proxy.address.replace('http://', '');
		proxyOpts.host = address.split(':')[0];
		proxyOpts.port = proxy.port || address.split(':')[1] || 1080;
		if (proxy.auth && proxy.auth.username) {
			proxyOpts.auth = {...proxy.auth};
		}

		if (proxyType === 'http' || proxyType === 'https') {
			this.options.agent = httpProxyAgent({proxy: proxyOpts});
		}
		else if (proxyType === 'socks' || proxyType === 'socks5') {
			this.options.agent = socksProxyAgent({proxy: proxyOpts});
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
		let body = this.options.body;
		const hasBody = ['POST', 'PUT', 'PATCH'].includes(this.options.method);

		if (!body) {
			if (!_.isEmpty(this.options.fields)) {
				body = this.options.fields;
				if (hasBody && !this.options.headers['content-type']) {
					this.contentType('form');
				}
			}
		}
		else if (typeof body === 'object') {
			if (!_.isEmpty(this.options.fields)) {
				Object.assign(body, this.options.fields);
			}
			if (hasBody && !this.options.headers['content-type']) {
				this.contentType('json');
			}
		}

		if (hasBody) {
			if (this.isJSON()) {
				if (typeof body === 'object') {
					body = JSON.stringify(body);
				}
			}
			else if (this.isForm()) {
				if (typeof body === 'object') {
					body = (new URLSearchParams(body)).toString();
				}
			}
		}
		else {
			this.options.query = this.options.query || {};
			if (body && (typeof body === 'object')) {
				Object.assign(body, this.options.query);
				this.options.query = body;
				body = '';
			}
		}

		if (!_.isEmpty(this.options.query)) {
			const qs = (new URLSearchParams(this.options.query)).toString();
			const joiner = this._url.includes('?') ? '&' : '?';
			this._url += (joiner + qs);
		}

		this._body = body;
	}

	/**
	 * Add cookies in the options to the header.
	 *
	 * NOTE: This function is for internal use
	 * @private
	 */
	async _addCookies() {
		const cookieMap = this.options.cookies || {};

		const cookies = [];
		_.forEach(cookieMap, (value, key) => {
			cookies.push(`${key}=${value}`);
		});

		const jar = this.options.readCookieJar || this.options.cookieJar;
		if (jar) {
			const jarCookies = await jar.getCookiesAsync(this._url, {});
			if (jarCookies) {
				jarCookies.forEach((cookie) => {
					if (!cookieMap[cookie.key]) {
						cookies.push(`${cookie.key}=${cookie.value}`);
					}
				});
			}
		}

		if (cookies.length) {
			this.header('cookie', cookies.join('; '));
		}
	}

	async _handleRedirect(response, ctx) {
		if (!this.options.followRedirect) return response;
		if (!('location' in response.headers)) return response;

		const statusCode = response.statusCode;
		const method = this.options.method;
		if (
			!allMethodRedirectCodes.has(statusCode) &&
			!(getMethodRedirectCodes.has(statusCode) && (method === 'GET' || method === 'HEAD'))
		) return response;

		const redirects = ctx.redirectUrls;

		// We're being redirected, we don't care about the response.
		response.resume();

		if (statusCode === 303) {
			// Server responded with "see other", indicating that the resource exists at another location,
			// and the client should request it from that location via GET or HEAD.
			this.options.method = 'GET';
		}

		if (redirects.length >= this.options.maxRedirects) {
			const err = new Error(`Redirected max ${this.options.maxRedirects} times. Aborting.`);
			err.code = 'EMAXREDIRECTS';
			throw err;
		}

		// Handles invalid URLs.
		const redirectBuffer = Buffer.from(response.headers.location, 'binary').toString();
		const redirectURL = new URL(redirectBuffer, response.url).toString();
		redirects.push(redirectURL);

		return this._request(redirectURL, ctx);
	}

	async _setCookies(response) {
		const jar = this.options.cookieJar;
		if (!jar) return;

		const cookies = response.headers['set-cookie'];
		if (!cookies) return;

		await Promise.all(cookies.map(cookie => jar.setCookieAsync(cookie, response.url)));
	}

	/**
	 * get options for underlying library (got)
	 * @private
	 */
	_getOptions() {
		const options = {
			throwHttpErrors: false,
			agent: this.options.agent,
			decompress: this.options.compress,
			timeout: this.options.timeout,
			encoding: this.options.encoding,
			body: this._body,
			headers: this.options.headers,
			method: this.options.method,
			rejectUnauthorized: this.options.strictSSL,
			retry: 0,
			// followRedirect is handled internally by us
			followRedirect: false,
			// max redirects is handled by us internally
			// cookieJar is handled by us internally
			// proxy is handled by us internally
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
			const contents = await File(cacheFilePath).read();
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

	async _request(url, ctx) {
		await this._addCookies();

		const gotOptions = this._getOptions(this.options);
		try {
			let response = await got(url, gotOptions);

			const status = response.statusCode;
			if (status === 407) {
				const e = new Error('407 Proxy Authentication Failed');
				e.code = 'EPROXYAUTH';
				throw e;
			}

			// already supported by got
			// response.url = response.request.uri.href || url;
			// already supported by got
			// response.requestUrl = url;
			// already supported by got
			// response.headers
			response.status = status;

			await this._setCookies(response);
			response = await this._handleRedirect(response, ctx);
			return response;
		}
		catch (e) {
			if (e instanceof got.TimeoutError) {
				const err = new Error('Request Timed Out');
				err.code = 'ETIMEDOUT';
				throw err;
			}

			const message = e.message.toLowerCase();
			if (
				message.includes('statusCode=407') ||
				(message.includes('authentication') && message.includes('socks'))
			) {
				const err = new Error('407 Proxy Authentication Failed');
				err.code = 'EPROXYAUTH';
				throw err;
			}

			throw e;
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
		this._parseUrl();
		this._addProxy();
		this._addFields();

		const startTime = Date.now();
		const ctx = {
			redirectUrls: [],
		};

		try {
			const response = await this._request(this._url, ctx);
			response.redirectUrls = ctx.redirectUrls;
			response.startTime = startTime;
			response.timeTaken = Date.now() - startTime;
			response.cached = false;

			await this._writeCache(response, cacheFilePath);
			return response;
		}
		catch (e) {
			e.timeTaken = Date.now() - startTime;
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
		return this._readCache();
	}

	async _fetchCached() {
		if (!this.promise) {
			this.promise = this.fetch();
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
		return this._fetchCached().then(successCallback, errorCallback);
	}

	/**
	 * It is also used for method chaining, but handles rejected cases only.
	 *
	 * @template T
	 * @param  {(err: Error) => T} errorCallback function to be called if the Promise is rejected
	 * @return {Promise<T>} a Promise in pending state
	 */
	async catch(errorCallback) {
		return this._fetchCached().catch(errorCallback);
	}

	/**
	 * finally method of promise returned
	 * @param {() => T} callback function to be called if the promise is fullfilled or rejected
	 * @return {Promise<T>} a Promise in pending state
	 */
	async finally(callback) {
		return this._fetchCached().finally(callback);
	}
}

export default Connect;
