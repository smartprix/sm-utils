const fs = require('fs');
const _ = require('lodash');

const config = {};
const fileCache = {};
let configRead = false;

/**
 * These are all available through cfg
 * @see cfg
 * @namespace config
 */

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

/**
 * Reads a config value
 * @param {String} key key to read, can be nested like `a.b.c`
 * @param {*} defaultValue value to return if key is not found
 * @return {any}
 */
function cfg(key, defaultValue) {
	// eslint-disable-next-line no-use-before-define
	readDefaultConfigFiles();
	return _.get(config, key, defaultValue);
}

/**
 * Will read env vars of the format CFG__JSON_KEY__PATH=$VAL
 * It will set the key 'jsonKey.path' with $VAL
 * _ to specify where to capitalize for camelCase
 * __ to seperate the key path
 * @private
 */
function readEnvVariables() {
	const vals = Object.keys(process.env).filter(val => val.indexOf('CFG__') === 0);
	vals.forEach((val) => {
		const key = val.slice(5).split('__').map(el => _.camelCase(el)).join('.');
		cfg.set(key, process.env[val]);
	});
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
	readEnvVariables();
}
/**
 * @memberOf config
 * @param {string} key
 * @param {any} defaultValue
 * @return {any}
 */
cfg.get = function (key, defaultValue) {
	return cfg(key, defaultValue);
};

/** set values in global config
 * you can also give key as an object to assign all key values from it
 * @memberOf config
 * @return {null}
 */
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

/**
 * set values in global config with an object to assign all key values from it
 * if a key already exists then it is merged with new value
 * if obj is not an Object then nothing happens
 * @memberOf config
 * @return {null}
 */
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

/**
 * set values in global config with an object to assign all key values from it
 * if a key already exists then it is assigned with new value
 * if obj is not an Object then nothing happens
 * @memberOf config
 * @return {null}
 */
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

/**
 * @memberOf config
 * @return {void}
 */
cfg.delete = function (key) {
	readDefaultConfigFiles();
	delete config[key];
};

/**
 * read config from a file, and merge with existing config
 * @memberOf config
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
 * @memberOf config
 * @param {String} key
 * @return {any} value
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

/**
 * @memberOf config
 * @return {boolean}
 */
cfg.isProduction = function () {
	return process.env.NODE_ENV === 'production';
};

/**
 * @memberOf config
 * @return {boolean}
 */
cfg.isStaging = function () {
	return process.env.NODE_ENV === 'staging';
};

/**
 * Returns true if env is production or staging
 * @memberOf config
 * @return {boolean}
 */
cfg.isProductionLike = function () {
	return (process.env.NODE_ENV === 'production') || (process.env.NODE_ENV === 'staging');
};

/**
 * @memberOf config
 * @return {boolean}
 */
cfg.isTest = function () {
	return process.env.NODE_ENV === 'test';
};

/**
 * @memberOf config
 * @return {boolean}
 */
cfg.isDev = function () {
	return (process.env.NODE_ENV !== 'production') && (process.env.NODE_ENV !== 'staging');
};

cfg.is_production = cfg.isProduction;
cfg.isProd = cfg.isProduction;
cfg.is_prod = cfg.isProduction;
cfg.is_staging = cfg.isStaging;
cfg.isProdLike = cfg.isProductionLike;
cfg.is_dev = cfg.isDev;
cfg.isDevelopment = cfg.isDev;
cfg.is_test = cfg.isTest;

module.exports = cfg;
