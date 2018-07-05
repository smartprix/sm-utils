import path from 'path';
import _ from 'lodash';
import request from 'request';
import FileCookieStore from 'tough-cookie-file-store';
import SocksHTTPAgent from 'sm-socks5-http-client/lib/Agent';
import SocksHTTPSAgent from 'socks5-https-client/lib/Agent';
import file from './file';
import Crypt from './Crypt';

const userAgents = {
	chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
	edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393',
	firefox: 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
	ie: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
	operaMini: 'Opera/9.80 (Android; Opera Mini/8.0.1807/36.1609; U; en) Presto/2.12.423 Version/12.16',
	googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	googlebotMobile: '​Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	mobile: 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36',
	chromeMobile: 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36',
	android: 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.36',
	iphone: 'Mozilla/6.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/8.0 Mobile/10A5376e Safari/8536.25',
	safariMobile: 'Mozilla/6.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/8.0 Mobile/10A5376e Safari/8536.25',
	tablet: 'Mozilla/5.0 (iPad; CPU OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.0.2 Mobile/9A5248d Safari/6533.18.5',
	ipad: 'Mozilla/5.0 (iPad; CPU OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.0.2 Mobile/9A5248d Safari/6533.18.5',
};

/**
 * Returns proxy url based on the proxy options.
 *
 * @param  {Object} proxy proxy options
 * @return {String}       proxy url based on the options
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
 * Class representing a Connection.
 */
class Connect {
	/**
	 * Creates a new Connect object.
	 * @constructor
	 */
	constructor() {
		/** Timeout period for the request in milliseconds */
		this.requestTimeout = 120 * 1000;
		/** Various options (or parameters) defining the Connection */
		this.options = {
			url: null,
			method: 'GET',
			headers: {
				'User-Agent': userAgents.chrome,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.8',
			},
			cookies: {},
			jar: null,
			followRedirect: true,
			maxRedirects: 6,
			gzip: true,
			// timeout: 120 * 1000,
			strictSSL: false,
			proxy: {},
			// tunnel: true,
			fields: {},
		};
	}

	/**
	 * Set the url for the connection.
	 *
	 * @param  {String} url self-descriptive
	 * @return {Connect}    self
	 */
	url(url) {
		this.options.url = url;
		return this;
	}

	/**
	 * @static
	 * Creates and returns a new Connect object with the given url.
	 *
	 * @param  {String} url self-descriptive
	 * @return {Connect}    A new Connect object with url set to the given url
	 */
	static url(url) {
		const connect = new this();
		connect.url(url);
		return connect;
	}

	/**
	* @static
	 * Returns a new cookie jar.
	 *
	 * @return {CookieJar} A cookie jar
	 */
	static newCookieJar(...args) {
		return request.jar(...args);
	}

	/**
	 * Set or unset the followRedirect option for the connection.
	 *
	 * @param  {Boolean} shouldFollowRedirect boolean representing whether to follow redirect or not
	 * @return {Connect}                      self
	 */
	followRedirect(shouldFollowRedirect) {
		this.options.followRedirect = shouldFollowRedirect;
		return this;
	}

	/**
	 * Set value of a header parameter for the connection.
	 *
	 * @param  {String} headerName name of the header parameter whose value is to be set
	 * @param  {*} headerValue     value to be set
	 * @return {Connect}           self
	 */
	header(headerName, headerValue) {
		if (typeof headerName === 'string') {
			this.options.headers[headerName] = headerValue;
		}
		else {
			_.assign(this.options.headers, headerName);
		}

		return this;
	}

	/**
	 * Set value of the headers for the connection.
	 *
	 * @param  {Object} headers object representing the headers for the connection
	 * @return {Connect}        self
	 */
	headers(headers) {
		_.assign(this.options.headers, headers);
		return this;
	}

	/**
	 * Set the body of the connection object.
	 *
	 * @param  {*} body                    value for body
	 * @param  {String} [contentType=null] string representing the content type of the body
	 * @return {Connect}                   self
	 */
	body(body, contentType = null) {
		if (_.isPlainObject(body)) {
			body = JSON.stringify(body);
			contentType = 'json';
		}

		if (contentType === 'json' || this.isJSON()) {
			this.header('Content-Type', 'application/json');
			if (typeof body !== 'string') {
				body = JSON.stringify(body);
			}
		}

		this.options.body = body;
		return this;
	}

	/**
	 * Set the 'Referer' field in the headers.
	 *
	 * @param  {String} referer referer value
	 */
	referer(referer) {
		this.header('Referer', referer);
	}

	/**
	 * Set the 'User-Agent' field in the headers.
	 *
	 * @param  {String} userAgent name of the user-agent or its value
	 * @return {Connect}          self
	 */
	userAgent(userAgent) {
		this.header('User-Agent', userAgents[userAgent] || userAgent);
		return this;
	}

	/**
	 * Set the 'Content-Type' field in the headers.
	 *
	 * @param  {String} contentType value for content-type
	 */
	contentType(contentType) {
		this.header('Content-Type', contentType);
	}

	/**
	 * Returns whether the content-type is JSON or not
	 *
	 * @return {Boolean} true, if content-type is JSON; false, otherwise
	 */
	isJSON() {
		return this.options.headers['Content-Type'] === 'application/json';
	}

	/**
	 * Sets the value of a cookie.
	 * Can be used to enable global cookies, if cookieName is set to true
	 * and cookieValue is undefined (or is not passed as an argument).
	 * Can also be used to set multiple cookies by passing in an object
	 * representing the cookies and their values as key:value pairs.
	 *
	 * @param  {String|Boolean|Object} cookieName  represents the name of the
	 * cookie to be set, or the cookies object
	 * @param  {Object} cookieValue                cookie value to be set
	 * @return {Connect}                           self
	 */
	cookie(cookieName, cookieValue) {
		if (cookieName === true && cookieValue === undefined) {
			this.globalCookies();
		}
		if (typeof cookieName === 'string') {
			this.options.cookies[cookieName] = cookieValue;
		}
		else {
			_.assign(this.options.cookies, cookieName);
		}

		return this;
	}

	/**
	 * Sets multiple cookies.
	 * Can be used to enable global cookies, if cookies is set to true.
	 *
	 * @param  {Object|Boolean} cookies object representing the cookies
	 * and their values as key:value pairs.
	 * @return {Connect}                self
	 */
	cookies(cookies) {
		if (cookies === true) {
			this.globalCookies();
		}
		else {
			_.assign(this.options.cookies, cookies);
		}

		return this;
	}

	/**
	 * Enable global cookies.
	 *
	 * @param  {Boolean} [enableGlobalCookies=true] self-descriptive
	 * @return {Connect}                            self
	 */
	globalCookies(enableGlobalCookies = true) {
		this.options.jar = enableGlobalCookies;
		return this;
	}

	/**
	 * Set the value of cookie jar based on a file (cookie store).
	 *
	 * @param  {String} fileName name of (or path to) the file
	 * @return {Connect}         self
	 */
	cookieFile(fileName) {
		const cookieJar = request.jar(new FileCookieStore(fileName));
		this.options.jar = cookieJar;
		return this;
	}

	/**
	 * Set the value of cookie jar.
	 *
	 * @param  {CookieJar} cookieJar value to be set
	 * @return {Connect}             self
	 */
	cookieJar(cookieJar) {
		this.options.jar = cookieJar;
		return this;
	}

	/**
	 * Set request timeout.
	 *
	 * @param  {Number} timeout timeout value in seconds
	 * @return {Connect}        self
	 */
	timeout(timeout) {
		this.requestTimeout = timeout * 1000;
		return this;
	}

	/**
	 * Set request timeout.
	 *
	 * @param  {Number} timeoutInMs timeout value in milliseconds
	 * @return {Connect}            self
	 */
	timeoutMs(timeoutInMs) {
		this.requestTimeout = timeoutInMs;
		return this;
	}

	/**
	 * alias for timeoutMs
	 */
	timeoutMilli(timeoutInMs) {
		return this.timeoutMs(timeoutInMs);
	}

	/**
	 * Set value of a field in the options.
	 * Can also be used to set multiple fields by passing in an object
	 * representing the field-names and their values as key:value pairs.
	 *
	 * @param  {String|Object} fieldName name of the field to be set, or the fields object
	 * @param  {*} fieldValue            value to be set
	 * @return {Connect}                 self
	 */
	field(fieldName, fieldValue) {
		if (typeof fieldName === 'string') {
			this.options.fields[fieldName] = fieldValue;
		}
		else {
			_.assign(this.options.fields, fieldName);
		}

		return this;
	}

	/**
	 * Set multiple fields.
	 *
	 * @param  {Object} fields object representing the field-names and their
	 * values as key:value pairs
	 * @return {Connect}       self
	 */
	fields(fields) {
		_.assign(this.options.fields, fields);
		return this;
	}

	/**
	 * Set the request method for the connection.
	 *
	 * @param  {String} method one of the HTTP request methods ('GET', 'PUT', 'POST', etc.)
	 * @return {Connect}       self
	 */
	method(method) {
		this.options.method = (method || 'GET').toUpperCase();
		return this;
	}

	/**
	 * Set username and password for authentication.
	 *
	 * @param  {String} username self-descriptive
	 * @param  {String} password self-descriptive
	 * @return {Connect}         self
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
	 * @param  {String|Object} proxy proxy address, or object representing proxy options
	 * @return {Connect}             self
	 */
	proxy(proxy) {
		// actual proxy is added at the end using _addProxy
		// this is because we need the url (http or https) to add the proxy
		// and url might be added after this method
		if (typeof proxy === 'string') {
			_.assign(this.options.proxy, {
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
	 * @param  {String} proxyAddress self-descriptive
	 * @param  {Number} proxyPort    self-descriptive
	 * @return {Connect}             self
	 */
	httpProxy(proxyAddress, proxyPort) {
		_.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'http',
		});

		return this;
	}

	/**
	 * Set address and port for a socks proxy.
	 *
	 * @param  {String} proxyAddress self-descriptive
	 * @param  {Number} proxyPort    self-descriptive
	 * @return {Connect}             self
	 */
	socksProxy(proxyAddress, proxyPort) {
		_.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'socks',
		});

		return this;
	}

	/**
	 * Set username and password for proxy.
	 *
	 * @param  {String} username self-descriptive
	 * @param  {String} password self-descriptive
	 * @return {Connect}         self
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
	 * @param  {String} dir name or path to the directory
	 * @return {Connect}    self
	 */
	cacheDir(dir) {
		this.resposeCacheDir = dir;
		return this;
	}

	/**
	 * Set if the body is to be returned as a buffer
	 *
	 * @param  {Boolean} [returnAsBuffer=true] self-descriptive
	 * @return {Connect}                       self
	 */
	asBuffer(returnAsBuffer = true) {
		this.options.encoding = returnAsBuffer ? null : undefined;
		return this;
	}

	/**
	 * Set the path for file for saving the response.
	 *
	 * @param  {String} filePath self-descriptive
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
			if (_.startsWith(this.options.url, 'https://')) {
				this.options.agentClass = SocksHTTPSAgent;
			}
			else {
				this.options.agentClass = SocksHTTPAgent;
			}

			const agentOptions = {};
			agentOptions.socksHost = proxy.address.split(':')[0];
			agentOptions.socksPort = proxy.port || proxy.address.split(':')[1] || 1080;
			if (proxy.auth && proxy.auth.username) {
				agentOptions.socksUsername = proxy.auth.username;
				agentOptions.socksPassword = proxy.auth.password;
			}

			this.options.agentOptions = agentOptions;
		}
	}

	/**
	 * Add the options 'fields' to the options body, form or qs
	 * on the basis of the request method.
	 *
	 * NOTE: This function is for internal use
	 */
	_addFields() {
		if (!this.options.fields) return;
		if (_.isEmpty(this.options.fields)) return;

		const method = this.options.method;
		if (method === 'POST' || method === 'PUT') {
			if (this.isJSON()) {
				this.options.body = JSON.stringify(this.options.fields);
			}
			else {
				this.options.form = this.options.fields;
			}
		}
		else {
			this.options.qs = this.options.qs || {};
			_.assign(this.options.qs, this.options.fields);
		}
	}

	/**
	 * Add cookies in the options to the header.
	 *
	 * NOTE: This function is for internal use
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
	 * It resolves or rejects the promise object. It is
	 * used by fetch() to make the promise.
	 *
	 * NOTE: This function is for internal use
	 */
	_makeFetchPromise(resolve, reject, cacheFilePath) {
		this._addProxy();
		this._addFields();
		this._addCookies();

		const startTime = Date.now();
		const req = request(this.options, (error, response, body) => {
			if (this.timeoutTimer) {
				clearTimeout(this.timeoutTimer);
				this.timeoutTimer = null;
			}

			if (error) {
				error.timeTaken = Date.now() - startTime;
				reject(error);
				return;
			}
			else if (response.statusCode === 407) {
				const e = new Error('407 Proxy Authentication Required');
				e.code = 'EPROXYAUTH';
				e.timeTaken = Date.now() - startTime;
				reject(e);
				return;
			}

			response.body = body;
			response.url = response.request.uri.href || this.options.url;
			response.timeTaken = Date.now() - startTime;
			response.cached = false;
			response.status = response.statusCode;

			const promises = [];

			if (this.saveFilePath) {
				promises.push(file(this.saveFilePath).write(response.body));
			}
			if (cacheFilePath && response.statusCode === 200) {
				promises.push(file(cacheFilePath).write(response.body));
			}

			if (promises.length) {
				Promise.all(promises)
					.then(() => { resolve(response) })
					.catch(() => { resolve(response) });
			}
			else {
				resolve(response);
			}
		});

		if (this.requestTimeout) {
			this.timeoutTimer = setTimeout(() => {
				try {
					req.abort();
				}
				catch (err) {
					// ignore errors
				}
				finally {
					const e = new Error('Request Timed Out');
					e.code = 'ETIMEDOUT';
					e.timeTaken = Date.now() - startTime;
					reject(e);
				}
			}, this.requestTimeout);
		}
	}

	/**
	 * It creates and returns a promise based on the information
	 * passed to and parameters of this object.
	 *
	 * Response contains {body, url, timeTaken, cached, statusCode}
	 * url is the final url downloaded after following all redirects
	 * cached is false is the response was downloaded, true if returned from a cached file
	 * timeTaken is time taken (in ms) for the request
	 * body contains the actual response body
	 *
	 * @return {Promise} a promise that resolves to response
	 */
	fetch() {
		if (this.promise) return this.promise;

		if (this.timeoutTimer) {
			clearTimeout(this.timeoutTimer);
			this.timeoutTimer = null;
		}

		this.promise = new Promise((resolve, reject) => {
			let cacheFilePath = null;

			if (this.resposeCacheDir) {
				const cacheKey = Crypt.md5(
					JSON.stringify(_.pick(this.options, ['url', 'method', 'fields']))
				);

				cacheFilePath = path.join(this.resposeCacheDir, cacheKey);
				file(cacheFilePath).read().then((cachedContents) => {
					const response = {
						body: cachedContents,
						statusCode: 200,
						status: 200,
						url: this.options.url,
						timeTaken: 0,
						cached: true,
					};

					resolve(response);
				}).catch(() => {
					// Ignore Errors
					this._makeFetchPromise(resolve, reject, cacheFilePath);
				});
			}
			else {
				this._makeFetchPromise(resolve, reject, cacheFilePath);
			}
		});

		return this.promise;
	}

	/**
	 * It is used for method chaining.
	 *
	 * @param  {function} successCallback function to be called if the Promise is fulfilled
	 * @param  {function} errorCallback   function to be called if the Promise is rejected
	 * @return {Promise}                  a Promise in pending state
	 */
	then(successCallback, errorCallback) {
		return this.fetch().then(successCallback, errorCallback);
	}

	/**
	 * It is also used for method chaining, but handles rejected cases only.
	 *
	 * @param  {function} errorCallback   function to be called if the Promise is rejected
	 * @return {Promise}                  a Promise in pending state
	 */
	catch(errorCallback) {
		return this.fetch().catch(errorCallback);
	}
}

export default Connect;
