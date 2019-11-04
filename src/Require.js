/* eslint-disable global-require, import/no-dynamic-require */
import path from 'path';
import {execSync} from 'child_process';

/**
 * Helpers for requiring global & other files
 * @namespace Require
 */

// assign properties to global to avoid issues in case of multiple sm-utils in node_modules
// NOTE: don't change globalDataKey or globalData properties
// it should be consistent across multiple sm-utils versions
const globalDataKey = '_SmUtils_Require';
if (!global[globalDataKey]) global[globalDataKey] = {};
const globalData = global[globalDataKey];

function setNpmPrefix(prefix) {
	globalData.npmPrefix = prefix;
}

function getNpmPrefix() {
	if (globalData.npmPrefix != null) return globalData.npmPrefix;

	let npmPrefix;
	try {
		npmPrefix = execSync('npm config get prefix').toString().trim();
		if (npmPrefix) npmPrefix = path.join(npmPrefix, 'lib/node_modules');

		// `npm config get prefix` returns `/usr/local` instead of `/usr` sometimes
		// see if `/usr/local` is actually correct
		if (npmPrefix === '/usr/local/lib/node_modules') {
			try {
				require.resolve(path.join(npmPrefix, 'npm'));
			}
			catch (e) {
				npmPrefix = '/usr/lib/node_modules';
			}
		}
	}
	catch (e) {
		npmPrefix = '';
	}

	globalData.npmPrefix = npmPrefix;
	return npmPrefix;
}

function getYarnPrefix() {
	if (globalData.yarnPrefix != null) return globalData.yarnPrefix;

	let yarnPrefix;
	try {
		yarnPrefix = execSync('yarn global dir').toString().trim();
		if (yarnPrefix) yarnPrefix = path.join(yarnPrefix, 'node_modules');
	}
	catch (e) {
		yarnPrefix = '';
	}

	globalData.yarnPrefix = yarnPrefix;
	return yarnPrefix;
}

/**
 * Resolve path of a global module
 * @memberof Require
 * @param {string} moduleName
 * @return {string} path of module
 */
function resolveGlobal(moduleName) {
	const npmPrefix = getNpmPrefix();
	if (npmPrefix) {
		try {
			return require.resolve(path.join(npmPrefix, moduleName));
		}
		catch (e) {
			// Ignore errors
		}
	}

	const yarnPrefix = getYarnPrefix();
	if (yarnPrefix) {
		try {
			return require.resolve(path.join(yarnPrefix, moduleName));
		}
		catch (e) {
			// Ignore errors
		}
	}

	throw new Error(`[Require Global] Module Not Found ${moduleName}`);
}

/**
 * Resolve path of a local or global module
 * @memberof Require
 * @param {string} moduleName
 * @param {object} [options={}]
 * @param {boolean} [options.useNative=true] Use local module if available
 * @return {string} path of module
 */
function resolve(moduleName, options = {}) {
	if (options.useNative !== false) {
		options.useNative = true;
	}

	if (options.useNative) {
		try {
			return require.resolve(moduleName);
		}
		catch (e) {
			// Ignore errors
		}
	}

	return resolveGlobal(moduleName);
}

/**
 * Require a module from local or global
 * @memberof Require
 * @param {string} moduleName
 * @param {object} [options={}]
 * @param {boolean} [options.useNative=true] Use local module if available
 * @return {any} the module required
 */
function requireModule(moduleName, options = {}) {
	return require(resolve(moduleName, options));
}

/**
 * Require a global module
 * @memberof Require
 * @param {string} moduleName
 * @return {any} the module required
 */
function requireGlobal(moduleName) {
	return require(resolveGlobal(moduleName));
}

module.exports = {
	resolve,
	resolveGlobal,
	requireGlobal,
	/**
	 * @type {Require.requireGlobal}
	 * @memberof Require
	 */
	global: requireGlobal,
	/**
	 * @type {Require.requireModule}
	 * @memberof Require
	 */
	require: requireModule,
};
