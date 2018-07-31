/* eslint-disable global-require, import/no-dynamic-require */
import path from 'path';
import {execSync} from 'child_process';

// assign properties to global to avoid issues in case of multiple sm-utils in node_modules
// NOTE: don't change globalDataKey or globalData properties
// it should be consistent across multiple sm-utils versions
const globalDataKey = '_SmUtils_Require';
if (!global[globalDataKey]) global[globalDataKey] = {};
const globalData = global[globalDataKey];

function getNpmPrefix() {
	if (globalData.npmPrefix != null) return globalData.npmPrefix;

	let npmPrefix;
	try {
		npmPrefix = execSync('npm config get prefix').toString().trim();
		if (npmPrefix) npmPrefix = path.join(npmPrefix, 'lib/node_modules');
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

function requireModule(moduleName, options = {}) {
	return require(resolve(moduleName, options));
}

function requireGlobal(moduleName, options = {}) {
	return require(resolveGlobal(moduleName, options));
}

module.exports = {
	resolve,
	resolveGlobal,
	requireGlobal,
	global: requireGlobal,
	require: requireModule,
};
