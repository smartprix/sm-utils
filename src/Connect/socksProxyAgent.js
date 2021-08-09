const {SocksProxyAgent} = require('socks-proxy-agent');

function getOpts(options) {
	const proxy = options.proxy || {};
	const opts = {};
	opts.host = proxy.host || 'localhost';
	opts.port = proxy.port || 1080;
	if (proxy.auth && proxy.auth.username) {
		opts.username = proxy.auth.username;
		opts.password = proxy.auth.password;
	}
	return opts;
}

function socksAgents(options) {
	const agent = new SocksProxyAgent(getOpts(options))
	return {
		http: agent,
		https: agent,
	};
}

export {
	socksAgents,
};
