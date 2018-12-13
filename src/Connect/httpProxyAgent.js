import tunnel from 'sm-tunnel-agent';

function modifyOpts(options) {
	const proxy = options.proxy;
	if (!proxy.proxyAuth && proxy.auth && proxy.auth.username) {
		proxy.proxyAuth = `${proxy.auth.username}:${proxy.auth.password}`;
	}
}

function httpAgent(options) {
	modifyOpts(options);
	return tunnel.httpOverHttp(options);
}

function httpsAgent(options) {
	modifyOpts(options);
	return tunnel.httpsOverHttp(options);
}

export {
	httpAgent,
	httpsAgent,
};
