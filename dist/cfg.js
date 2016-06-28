const _ = require('lodash');

let config = {};

function cfg(key, defaultValue) {
	if (key in config) {
		return config[key];
	}

	return defaultValue;
}

cfg.get = function (key, defaultValue) {
	return cfg(key, defaultValue);
};

// set values in global config
// you can also give key as an object to assign all key values from it
cfg.set = function (key, value) {
	// if key is Object then merge it with existing config
	if (value === undefined && key instanceof Object) {
		config = _.assign(config, key);
		return null;
	}

	const prev = config[key];
	config[key] = value;
	return prev;
};

cfg.delete = function (key) {
	delete config[key];
};

module.exports = cfg;