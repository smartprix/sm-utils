const fs = require('fs');
const _ = require('lodash');

const config = {};
const fileCache = {};
let configRead = false;

// merge configs, takes care of getters while merging
function merge(conf, confPrivate) {
	if (!confPrivate) return conf;

	Object.keys(confPrivate).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(conf, key)) {
			if (confPrivate[key] === Object(confPrivate[key])) {
				if (conf[key] !== Object(conf[key])) conf[key] = {};
				merge(conf[key], confPrivate[key]);
			}
			else {
				Object.defineProperty(conf, key, Object.getOwnPropertyDescriptor(confPrivate, key));
			}
		}
		else {
			Object.defineProperty(conf, key, Object.getOwnPropertyDescriptor(confPrivate, key));
		}
	});

	return conf;
}

function cfg(key, defaultValue) {
	// eslint-disable-next-line no-use-before-define
	readDefaultConfigFiles();
	return _.get(config, key, defaultValue);
}

function readDefaultConfigFiles() {
	if (configRead) return;
	configRead = true;

	const env = process.env.NODE_ENV || 'development';
	cfg.file(`${process.cwd()}/config.js`, {ignoreNotFound: true});
	cfg.file(`${process.cwd()}/config.${env}.js`, {ignoreNotFound: true});
	cfg.file(`${process.cwd()}/private/config.js`, {ignoreNotFound: true});
	cfg.file(`${process.cwd()}/private/config.${env}.js`, {ignoreNotFound: true});

	if (config.$privateConfigFile) {
		cfg.file(config.$privateConfigFile, {ignoreNotFound: true});
	}
}

cfg.get = function (key, defaultValue) {
	return cfg(key, defaultValue);
};

// set values in global config
// you can also give key as an object to assign all key values from it
cfg.set = function (key, value) {
	readDefaultConfigFiles();

	// if key is Object then merge it with existing config
	if (value === undefined && key instanceof Object) {
		const env = process.env.NODE_ENV || 'development';
		Object.assign(config, key);
		Object.assign(config, key[`$env_${env}`]);
		return null;
	}

	const prev = _.get(config, key);
	_.set(config, key, value);
	return prev;
};

// set values in global config with an object to assign all key values from it
// if a key already exists then it is merged with new value
// if obj is not an Object then nothing happens
cfg.merge = function (obj) {
	readDefaultConfigFiles();

	if (obj instanceof Object) {
		const env = process.env.NODE_ENV || 'development';
		merge(config, obj);
		merge(config, obj[`$env_${env}`]);
		return null;
	}

	return null;
};

// set values in global config with an object to assign all key values from it
// if a key already exists then it is assigned with new value
// if obj is not an Object then nothing happens
cfg.assign = function (obj) {
	readDefaultConfigFiles();

	if (obj instanceof Object) {
		const env = process.env.NODE_ENV || 'development';
		Object.assign(config, obj);
		Object.assign(config, obj[`$env_${env}`]);
		return null;
	}
	return null;
};

cfg.delete = function (key) {
	readDefaultConfigFiles();
	delete config[key];
};

/**
 * read config from a file, and merge with existing config
 * @param {string} file path of the file to read (only absolute paths)
 * @param {object} options
 * 	options = {ignoreErrors = ignore all errors, ignoreNotFound = ignore if file not found}
 */
cfg.file = function (file, options = {}) {
	if (!file.startsWith('/')) {
		throw new Error('Only absolute paths are allowed');
	}

	if (!configRead) readDefaultConfigFiles();

	try {
		// eslint-disable-next-line global-require, import/no-dynamic-require
		const data = require(file);
		cfg.merge(data);
	}
	catch (e) {
		if (e.code === 'MODULE_NOT_FOUND' && options.ignoreNotFound) {
			// Ignore Not Found Errors
			return;
		}
		else if (options.ignoreErrors) {
			// Ignore All Errors
			return;
		}

		throw e;
	}
};

/**
 * read the file specified by the key, and then cache it
 * @param {String} key
 */
cfg.read = function (key) {
	if (key in fileCache) {
		return fileCache[key];
	}

	const filePath = cfg(key);
	if (!filePath) {
		fileCache[key] = undefined;
	}
	else {
		try {
			fileCache[key] = fs.readFileSync(filePath);
		}
		catch (e) {
			console.error(`[cfg] can't read file ${key}: ${filePath}`, e);
		}
	}

	return fileCache[key];
};

cfg.is_production = function () {
	return process.env.NODE_ENV === 'production';
};

cfg.is_staging = function () {
	return process.env.NODE_ENV === 'staging';
};

cfg.is_test = function () {
	return process.env.NODE_ENV === 'test';
};

cfg.is_dev = function () {
	return !cfg.is_production();
};

cfg.isProduction = cfg.is_production;
cfg.isProd = cfg.is_production;
cfg.is_prod = cfg.is_production;
cfg.isStaging = cfg.is_staging;
cfg.isDev = cfg.is_dev;
cfg.isTest = cfg.is_test;

module.exports = cfg;
