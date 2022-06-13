import tunnel from 'sm-tunnel-agent';

function modifyOpts(options) {
	const proxy = options.proxy;
	if (!proxy.proxyAuth && proxy.auth && proxy.auth.username) {
		proxy.proxyAuth = `${proxy.auth.username}:${proxy.auth.password}`;
	}
}

function httpProxyAgents(options) {
	modifyOpts(options);
	return {
		http: tunnel.httpOverHttp(options),
		https: tunnel.httpsOverHttp(options),
	};
}

function httpsProxyAgents(options) {
	modifyOpts(options);
	return {
		http: tunnel.httpOverHttps(options),
		https: tunnel.httpsOverHttps(options),
	};
}

export {
	httpProxyAgents,
	httpsProxyAgents,
};
