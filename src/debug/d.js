/* eslint-disable global-require */
const cfg = require('./../cfg');

// noop all the functions in production
if (cfg.isProductionLike()) {
	const d = function () {};
	d.dump = function () {};
	d.trace = function () {};
	d.getTrace = function () {};
	d.enableUncaughtHandler = function () {};
	d.disableUncaughtHandler = function () {};

	module.exports = d;
}
else {
	module.exports = require('./d_real');
}
