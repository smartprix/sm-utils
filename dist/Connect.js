Object.defineProperty(exports, "__esModule", {
	value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _toughCookieFileStore = require('tough-cookie-file-store');

var _toughCookieFileStore2 = _interopRequireDefault(_toughCookieFileStore);

var _Agent = require('socks5-http-client/lib/Agent');

var _Agent2 = _interopRequireDefault(_Agent);

var _Agent3 = require('socks5-https-client/lib/Agent');

var _Agent4 = _interopRequireDefault(_Agent3);

var _file = require('./file');

var _file2 = _interopRequireDefault(_file);

var _crypt = require('./crypt');

var _crypt2 = _interopRequireDefault(_crypt);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
	ipad: 'Mozilla/5.0 (iPad; CPU OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.0.2 Mobile/9A5248d Safari/6533.18.5'
};

function makeProxyUrl(proxy) {
	let url = proxy.address.replace('http://', '');
	if (proxy.port) {
		url = proxy.address.split(':')[0] + ':' + proxy.port;
	}
	if (proxy.auth && proxy.auth.username) {
		url = `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password)}@${proxy.address}`;
	}

	return `http://${url}`;
}

class Connect {
	constructor() {
		this.requestTimeout = 120 * 1000;
		this.options = {
			url: null,
			method: 'GET',
			headers: {
				'User-Agent': userAgents.chrome,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.8'
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
			fields: {}
		};
	}

	url(url) {
		this.options.url = url;
		return this;
	}

	static url(url) {
		const connect = new this();
		connect.url(url);
		return connect;
	}

	static newCookieJar(...args) {
		return _request2.default.jar(...args);
	}

	followRedirect(shouldFollowRedirect) {
		this.options.followRedirect = shouldFollowRedirect;
		return this;
	}

	header(headerName, headerValue) {
		if (typeof headerName === 'string') {
			this.options.headers[headerName] = headerValue;
		} else {
			_lodash2.default.assign(this.options.headers, headerName);
		}

		return this;
	}

	headers(headers) {
		_lodash2.default.assign(this.options.headers, headers);
		return this;
	}

	body(body, contentType = null) {
		if (_lodash2.default.isPlainObject(body)) {
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

	referer(referer) {
		this.header('Referer', referer);
	}

	userAgent(userAgent) {
		this.header('User-Agent', userAgents[userAgent] || userAgent);
		return this;
	}

	contentType(contentType) {
		this.header('Content-Type', contentType);
	}

	isJSON() {
		return this.options.headers['Content-Type'] === 'application/json';
	}

	cookie(cookieName, cookieValue) {
		if (cookieName === true && cookieValue === undefined) {
			this.globalCookies();
		}
		if (typeof cookieName === 'string') {
			this.options.cookies[cookieName] = cookieValue;
		} else {
			_lodash2.default.assign(this.options.cookies, cookieName);
		}

		return this;
	}

	cookies(cookies) {
		if (cookies === true) {
			this.globalCookies();
		} else {
			_lodash2.default.assign(this.options.cookies, cookies);
		}

		return this;
	}

	globalCookies(enableGlobalCookies = true) {
		this.options.jar = enableGlobalCookies;
		return this;
	}

	cookieFile(fileName) {
		const cookieJar = _request2.default.jar(new _toughCookieFileStore2.default(fileName));
		this.options.jar = cookieJar;
		return this;
	}

	cookieJar(cookieJar) {
		this.options.jar = cookieJar;
		return this;
	}

	timeout(timeout) {
		this.requestTimeout = timeout * 1000;
		return this;
	}

	timeoutMilli(timeoutInMs) {
		this.requestTimeout = timeoutInMs;
		return this;
	}

	field(fieldName, fieldValue) {
		if (typeof fieldName === 'string') {
			this.options.fields[fieldName] = fieldValue;
		} else {
			_lodash2.default.assign(this.options.fields, fieldName);
		}

		return this;
	}

	fields(fields) {
		_lodash2.default.assign(this.options.fields, fields);
		return this;
	}

	method(method) {
		this.options.method = method.toUpperCase();
		return this;
	}

	httpAuth(username, password) {
		this.options.auth = {
			username,
			password
		};
	}

	proxy(proxy) {
		// actual proxy is added at the end using _addProxy
		// this is because we need the url (http or https) to add the proxy
		// and url might be added after this method
		if (typeof proxy === 'string') {
			_lodash2.default.assign(this.options.proxy, {
				address: proxy,
				port: null,
				type: 'http'
			});
		} else {
			this.options.proxy = proxy;
		}

		return this;
	}

	httpProxy(proxyAddress, proxyPort) {
		_lodash2.default.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'http'
		});

		return this;
	}

	socksProxy(proxyAddress, proxyPort) {
		_lodash2.default.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'socks'
		});

		return this;
	}

	proxyAuth(username, password) {
		this.options.proxy.auth = {
			username,
			password
		};

		return this;
	}

	get() {
		this.method('GET');
		return this;
	}

	post() {
		this.method('POST');
		return this;
	}

	put() {
		this.method('PUT');
		return this;
	}

	cacheDir(dir) {
		this.resposeCacheDir = dir;
		return this;
	}

	save(filePath) {
		this.saveFilePath = filePath;
		return this;
	}

	_addProxy() {
		const proxy = this.options.proxy;
		if (!proxy) return;
		if (typeof proxy === 'string') return;

		this.options.proxy = null;
		if (!proxy.address) return;

		const proxyType = proxy.type || 'http';

		if (proxyType === 'http' || proxyType === 'https') {
			this.options.proxy = makeProxyUrl(proxy);
		} else if (proxyType === 'socks' || proxyType === 'socks5') {
			if (_lodash2.default.startsWith(this.options.url, 'https://')) {
				this.options.agentClass = _Agent4.default;
			} else {
				this.options.agentClass = _Agent2.default;
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

	_addFields() {
		if (!this.options.fields) return;
		if (_lodash2.default.isEmpty(this.options.fields)) return;

		const method = this.options.method;
		if (method === 'POST' || method === 'PUT') {
			if (this.isJSON()) {
				this.options.body = JSON.stringify(this.options.fields);
			} else {
				this.options.form = this.options.fields;
			}
		} else {
			this.options.qs = this.options.qs || {};
			_lodash2.default.assign(this.options.qs, this.options.fields);
		}
	}

	_addCookies() {
		if (!this.options.cookies) return;

		const cookies = [];
		_lodash2.default.forEach(this.options.cookies, (value, key) => {
			cookies.push(`${key}=${value}`);
		});

		if (cookies.length) {
			this.header('Cookie', cookies.join('; '));
		}
	}

	_makeFetchPromise(resolve, reject, cacheFilePath) {
		this._addProxy();
		this._addFields();
		this._addCookies();

		const startTime = Date.now();
		const req = (0, _request2.default)(this.options, (error, response, body) => {
			if (this.timeoutTimer) {
				clearTimeout(this.timeoutTimer);
				this.timeoutTimer = null;
			}

			if (error) {
				error.timeTaken = Date.now() - startTime;
				reject(error);
				return;
			} else if (response.statusCode === 407) {
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

			const promises = [];

			if (this.saveFilePath) {
				promises.push((0, _file2.default)(this.saveFilePath).write(response.body));
			}
			if (cacheFilePath && response.statusCode === 200) {
				promises.push((0, _file2.default)(cacheFilePath).write(response.body));
			}

			if (promises.length) {
				Promise.all(promises).then(() => {
					resolve(response);
				}).catch(() => {
					resolve(response);
				});
			} else {
				resolve(response);
			}
		});

		if (this.requestTimeout) {
			this.timeoutTimer = setTimeout(() => {
				try {
					req.abort();

					const e = new Error('Request Timed Out');
					e.code = 'ETIMEDOUT';
					e.timeTaken = Date.now() - startTime;
					reject(e);
				} catch (err) {
					const e = new Error('Request Timed Out');
					e.code = 'ETIMEDOUT';
					e.timeTaken = Date.now() - startTime;
					reject(e);
				}
			}, this.requestTimeout);
		}
	}

	fetch() {
		if (this.promise) return this.promise;

		if (this.timeoutTimer) {
			clearTimeout(this.timeoutTimer);
			this.timeoutTimer = null;
		}

		this.promise = new Promise((resolve, reject) => {
			let cacheFilePath = null;

			if (this.resposeCacheDir) {
				const cacheKey = _crypt2.default.md5(JSON.stringify(_lodash2.default.pick(this.options, ['url', 'method', 'fields'])));

				cacheFilePath = _path2.default.join(this.resposeCacheDir, cacheKey);
				(0, _file2.default)(cacheFilePath).read().then(cachedContents => {
					const response = {
						body: cachedContents,
						statusCode: 200,
						url: this.options.url,
						timeTaken: 0,
						cached: true
					};

					resolve(response);
				}).catch(e => {
					// Ignore Errors
					this._makeFetchPromise(resolve, reject, cacheFilePath);
				});
			} else {
				this._makeFetchPromise(resolve, reject, cacheFilePath);
			}
		});

		return this.promise;
	}

	then(successCallback, errorCallback) {
		return this.fetch().then(successCallback, errorCallback);
	}

	catch(errorCallback) {
		return this.fetch().catch(errorCallback);
	}
}

exports.default = Connect;