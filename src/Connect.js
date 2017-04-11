import _ from 'lodash';
import request from 'request';
import FileCookieStore from 'tough-cookie-file-store';
import SocksHTTPAgent from 'socks5-http-client/lib/Agent';
import SocksHTTPSAgent from 'socks5-https-client/lib/Agent';

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
			timeout: 120 * 1000,
			strictSSL: false,
			proxy: {},
			// tunnel: true,
			fields: {},
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
		return request.jar(...args);
	}

	followRedirect(shouldFollowRedirect) {
		this.options.followRedirect = shouldFollowRedirect;
		return this;
	}

	header(headerName, headerValue) {
		if (typeof headerName === 'string') {
			this.options.headers[headerName] = headerValue;
		}
		else {
			_.assign(this.options.headers, headerName);
		}

		return this;
	}

	headers(headers) {
		_.assign(this.options.headers, headers);
		return this;
	}

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
		}
		else {
			_.assign(this.options.cookies, cookieName);
		}

		return this;
	}

	cookies(cookies) {
		if (cookies === true) {
			this.globalCookies();
		}
		else {
			_.assign(this.options.cookies, cookies);
		}

		return this;
	}

	globalCookies(enableGlobalCookies = true) {
		this.options.jar = enableGlobalCookies;
		return this;
	}

	cookieFile(fileName) {
		const cookieJar = request.jar(new FileCookieStore(fileName));
		this.options.jar = cookieJar;
		return this;
	}

	cookieJar(cookieJar) {
		this.options.jar = cookieJar;
		return this;
	}

	timeout(timeout) {
		this.options.timeout = timeout * 1000;
		return this;
	}

	timeoutMilli(timeoutInMs) {
		this.options.timeout = timeoutInMs;
		return this;
	}

	field(fieldName, fieldValue) {
		if (typeof fieldName === 'string') {
			this.options.fields[fieldName] = fieldValue;
		}
		else {
			_.assign(this.options.fields, fieldName);
		}

		return this;
	}

	fields(fields) {
		_.assign(this.options.fields, fields);
		return this;
	}

	method(method) {
		this.options.method = method.toUpperCase();
	}

	httpAuth(username, password) {
		this.options.auth = {
			username,
			password,
		};
	}

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

	httpProxy(proxyAddress, proxyPort) {
		_.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'http',
		});

		return this;
	}

	socksProxy(proxyAddress, proxyPort) {
		_.assign(this.options.proxy, {
			address: proxyAddress,
			port: proxyPort,
			type: 'socks',
		});

		return this;
	}

	proxyAuth(username, password) {
		this.options.proxy.auth = {
			username,
			password,
		};

		return this;
	}

	get() {
		this.method('GET');
	}

	post() {
		this.method('POST');
	}

	put() {
		this.method('PUT');
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

	fetch() {
		if (this.promise) return this.promise;

		this._addProxy();
		this._addFields();
		this._addCookies();

		this.promise = new Promise((resolve, reject) => {
			const startTime = Date.now();
			request(this.options, (error, response, body) => {
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
				resolve(response);
			});
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

export default Connect;
