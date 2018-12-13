const http = require('http');
const https = require('https');
const tls = require('tls');
const socksClient = require('socks5-client');

function httpsConnection(options) {
	const socksSocket = socksClient.createConnection(options);
	const onProxied = socksSocket.onProxied;

	socksSocket.onProxied = () => {
		options.socket = socksSocket.socket;
		if (options.hostname) {
			options.servername = options.hostname;
		}
		else if (options.host) {
			options.servername = options.host.split(':')[0];
		}

		socksSocket.socket = tls.connect(options, () => {
			// Set the 'authorized flag for clients that check it.
			socksSocket.authorized = socksSocket.socket.authorized;
			onProxied.call(socksSocket);
		});

		socksSocket.socket.on('error', (err) => {
			socksSocket.emit('error', err);
		});
	};

	return socksSocket;
}

function modifyOpts(options) {
	const proxy = options.proxy;
	options.socksHost = proxy.host || 'localhost';
	options.socksPort = proxy.port || 1080;
	if (proxy.auth && proxy.auth.username) {
		options.socksUsername = proxy.auth.username;
		options.socksPassword = proxy.auth.password;
	}
}

class SocksHttpAgent extends http.Agent {
	constructor(options) {
		modifyOpts(options);
		super(options);
		this.createConnection = socksClient.createConnection;
	}
}

class SocksHttpsAgent extends https.Agent {
	constructor(options) {
		modifyOpts(options);
		super(options);
		this.createConnection = httpsConnection;
	}
}

function httpAgent(options) {
	return new SocksHttpAgent(options);
}

function httpsAgent(options) {
	return new SocksHttpsAgent(options);
}

export {
	httpAgent,
	httpsAgent,
};
