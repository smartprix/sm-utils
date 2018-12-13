import {expect} from 'chai';
import {createServer} from './helpers/createServer';
import {Connect, File} from '../src/index';

let server;

function serverUrl(url) {
	return `${server.url}/${url}`;
}

function connect(url) {
	return Connect.url(serverUrl(url));
}

function redirect(res, location, statusCode = 301) {
	res.setHeader('location', location);
	res.statusCode = statusCode;
	res.end();
}

function getBody(req, cb) {
	let body = '';
	req.on('data', (data) => {
		body += data;
	});

	req.on('end', () => {
		cb(body);
	});
}

describe('@connect class', () => {
	before(async () => {
		server = await createServer();
		await server.listen(server.port);

		server.on('/ip', (req, res) => {
			res.end('127.0.0.1');
		});

		server.on('/ip-redir', (req, res) => {
			redirect(res, '/ip');
		});

		server.on('/timeout', (req, res) => {
			// eslint-disable-next-line max-nested-callbacks
			setTimeout(() => res.end('hello'), 300);
		});

		server.on('/all', (req, res) => {
			// eslint-disable-next-line max-nested-callbacks
			getBody(req, (body) => {
				res.setHeader('set-cookie', ['hello=world', 'foo=bar']);
				res.end(JSON.stringify({
					cookies: req.headers.cookie || '',
					headers: req.headers,
					userAgent: req.headers['user-agent'] || '',
					contentType: req.headers['content-type'] || '',
					referer: req.headers.referer || '',
					ip: '127.0.0.1',
					method: req.method,
					body,
				}));
			});
		});
	});


	after(async () => {
		await server.close();
	});

	beforeEach(async function () {
		this.timeout(10000);
	});

	it('should correctly fetch the response', async () => {
		const response = await connect('ip');
		expect(response.statusCode).to.equal(200);
		expect(response.body).to.equal('127.0.0.1');
	});

	it('should correctly redirect', async () => {
		const response = await connect('ip-redir');
		expect(response.statusCode).to.equal(200);
		expect(response.body).to.equal('127.0.0.1');
		expect(response.url).to.equal(serverUrl('ip'));
	});

	it('should respect followRedirect(false)', async () => {
		const response = await connect('ip-redir')
			.followRedirect(false);
		expect(response.statusCode).to.equal(301);
		expect(response.headers.location).to.equal('/ip');
	});

	it('should respect followRedirect(true)', async () => {
		const response = await connect('ip-redir')
			.followRedirect();
		expect(response.statusCode).to.equal(200);
		expect(response.body).to.equal('127.0.0.1');
		expect(response.url).to.equal(serverUrl('ip'));
	});

	it('should correctly save the response', async () => {
		const responsePath = `${__dirname}/response.html`;
		const response = await connect('ip')
			.userAgent('mobile')
			.save(responsePath);

		const body = await File(responsePath).read();
		expect(body).to.match(/^\d{0,3}.\d{0,3}.\d{0,3}.\d{0,3}$/);
		expect(body).to.equal(response.body.toString());
		await File(responsePath).rm();
	});

	it('should correctly send headers', async () => {
		const response = await connect('all')
			.header('a', 'b')
			.header('C', 'd')
			.header({'e-H': 'f', 'X-Token': 'h'});
		const body = JSON.parse(response.body);
		expect(body.headers).to.contain({
			a: 'b',
			c: 'd',
			'e-h': 'f',
			'x-token': 'h',
		});
	});

	it('should correctly send fields', async () => {
		const response = await connect('all')
			.field('a', 'b')
			.field('C', 'd')
			.field({'e-H': 'f', 'X-Token': 'h'})
			.fields({'e-H': 'g', abcd: 'f1&10'})
			.post();
		const body = JSON.parse(response.body);
		expect(body.contentType).to.equal('application/x-www-form-urlencoded');
		expect(body.body).to.equal('a=b&C=d&e-H=g&X-Token=h&abcd=f1%2610');
		expect(response.url).to.not.contain('?a=b&C=d&e-H=f&X-Token=h');
	});

	it('should correctly send query', async () => {
		const response = await connect('all')
			.query('a', 'b')
			.query('C', 'd')
			.field({'e-H': 'g', abcd: 'f1&10'})
			.query({'e-H': 'f', 'X-Token': 'h'})
			.post();
		const body = JSON.parse(response.body);
		expect(body.contentType).to.equal('application/x-www-form-urlencoded');
		expect(body.body).to.equal('e-H=g&abcd=f1%2610');
		expect(response.url).to.contain('?a=b&C=d&e-H=f&X-Token=h');
	});

	it('should correctly send fields in get', async () => {
		const response = await connect('all')
			.field('a', 'b')
			.field('C', 'd')
			.field({'e-H': 'f', 'X-Token': 'h'})
			.fields({'e-H': 'g', abcd: 'f1&10'})
			.query('a', 'a1')
			.query({b: 'b1', 'e-H': 'e1'})
			.get();
		const body = JSON.parse(response.body);
		expect(body.contentType).to.equal('');
		expect(body.body).to.equal('');
		expect(response.url).to.contain('?a=a1&C=d&e-H=e1&X-Token=h&abcd=f1%2610&b=b1');
	});

	it('should correctly send body in json', async () => {
		const response = await connect('all')
			.body({a: 'b', c: 'd'})
			.field({e: 'f'})
			.field('g', 'h')
			.post();
		const body = JSON.parse(response.body);
		expect(body.contentType).to.equal('application/json');
		expect(body.body).to.equal('{"a":"b","c":"d","e":"f","g":"h"}');
		expect(response.url).to.not.contain('?a=b&C=d&e-H=f&X-Token=h');
	});

	it('should correctly send body in general', async () => {
		const response = await connect('all')
			.body('<html></html>')
			.field('g', 'h')
			.contentType('text/html')
			.post();
		const body = JSON.parse(response.body);
		expect(body.contentType).to.equal('text/html');
		expect(body.body).to.equal('<html></html>');
	});

	it('should correctly set inbuilt userAgent', async () => {
		const response = await connect('all')
			.userAgent('mobile');
		const body = JSON.parse(response.body);
		expect(body.userAgent).to.contain('Mobile Safari/537.36');
	});

	it('should correctly set custom userAgent', async () => {
		const response = await connect('all')
			.userAgent('smartprix crawler/1.0.1');
		const body = JSON.parse(response.body);
		expect(body.userAgent).to.contain('smartprix crawler/1.0.1');
	});

	it('should correctly set referer', async () => {
		const response = await connect('all')
			.referer('https://www.smartprix.com/mobiles/');
		const body = JSON.parse(response.body);
		expect(body.referer).to.equal('https://www.smartprix.com/mobiles/');
	});

	it('should correctly send cookies', async () => {
		const response = await connect('all')
			.cookie('a', 'b')
			.cookie('c', 'd')
			.cookie({e: 'f', g: 'h'});
		const body = JSON.parse(response.body);
		expect(body.cookies).to.equal('a=b; c=d; e=f; g=h');
	});

	it('should correctly send cookies using jar', async () => {
		const jar = Connect.newCookieJar();
		jar.setCookieSync('a=b', 'http://localhost');
		jar.setCookieSync('c=d', 'http://localhost');
		jar.setCookieSync('e=f', 'http://smartprix.com');
		const response = await connect('all')
			.cookieJar(jar);
		const body = JSON.parse(response.body);
		expect(body.cookies).to.equal('a=b; c=d');
	});

	it('should correctly set cookies in jar', async () => {
		const jar = Connect.newCookieJar();
		const response = await connect('all')
			.cookieJar(jar);
		expect(response.statusCode).to.equal(200);
		const cookies = jar.getCookiesSync(server.url);
		expect(cookies[0]).to.deep.contain({key: 'hello', value: 'world'});
		expect(cookies[1]).to.deep.contain({key: 'foo', value: 'bar'});
	});

	it('should correctly use globalCookies', async () => {
		const response = await connect('all')
			.globalCookies();
		const body = JSON.parse(response.body);
		expect(body.cookies).to.equal('');

		const response2 = await connect('all')
			.globalCookies();
		const body2 = JSON.parse(response2.body);
		expect(body2.cookies).to.equal('hello=world; foo=bar');
	});

	it('should correctly use cookieFile', async () => {
		const response = await connect('all')
			.cookieFile('cookies');
		const body = JSON.parse(response.body);
		expect(body.cookies).to.equal('');

		const response2 = await connect('all')
			.cookieFile('cookies');
		const body2 = JSON.parse(response2.body);
		expect(body2.cookies).to.equal('hello=world; foo=bar');

		await File('cookies').rm();
	});

	// TODO: merging should not require read only
	it('should merge local and global cookies', async () => {
		const jar = Connect.newCookieJar();
		await connect('all')
			.cookieJar(jar);

		const cookies1 = jar.getCookiesSync(server.url);
		expect(cookies1.length).to.equal(2);

		const response = await connect('all')
			.cookieJar(jar, {readOnly: true})
			.cookie('a', 'b')
			.cookie('hello', 'yo');

		const cookies2 = jar.getCookiesSync(server.url);
		expect(cookies2.length).to.equal(2);
		expect(cookies2[0]).to.deep.contain({key: 'hello', value: 'world'});
		expect(cookies2[1]).to.deep.contain({key: 'foo', value: 'bar'});

		const body = JSON.parse(response.body);
		expect(body.cookies).to.equal('a=b; hello=yo; foo=bar');
	});

	it('should correctly return body as buffer', async () => {
		const response = await connect('all')
			.body('<html></html>')
			.asBuffer()
			.post();
		expect(response.body).to.be.an.instanceOf(Buffer);
		const body = JSON.parse(response.body.toString());
		expect(body.body).to.equal('<html></html>');
	});

	it('should correctly respect timeout', async () => {
		const response1 = await connect('timeout').timeout(0.6);
		expect(response1.body).to.equal('hello');

		const response2 = await connect('timeout').timeoutMs(600);
		expect(response2.body).to.equal('hello');

		let responseTimeout = null;
		try {
			responseTimeout = await connect('timeout').timeoutMs(250);
		}
		catch (e) {
			expect(e.code).to.equal('ETIMEDOUT');
		}
		expect(responseTimeout).to.equal(null);
	});

	// Proxy tests
	// Commented out right now, because this requires an actual proxy
	/*
	it('should correctly use http proxy', async function () {
		this.timeout(20000);
		const proxy = {
			type: 'http',
			host: 'x.x.x.x',
			port: 80,
			auth: {
				username: 'xxx',
				password: 'xxx',
			},
		};

		const response = await Connect.url('http://www.smartprix.com/ip').proxy(proxy);
		expect(response.statusCode).to.equal(200);
		expect(response.url).to.equal('https://www.smartprix.com/ip');
		expect(response.body).to.equal(proxy.host);
	});

	it('should correctly use socks proxy', async function () {
		this.timeout(20000);
		const proxy = {
			type: 'socks',
			host: 'x.x.x.x',
			port: 1080,
			auth: {
				username: 'xxx',
				password: 'xxx',
			},
		};

		const response = await Connect.url('http://www.smartprix.com/ip').proxy(proxy);
		expect(response.statusCode).to.equal(200);
		expect(response.url).to.equal('https://www.smartprix.com/ip');
		expect(response.body).to.equal(proxy.host);
	});
	*/
});
