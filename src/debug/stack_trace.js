/* eslint-disable no-useless-escape, no-bitwise */
const stackTrace = require('stack-trace');
const path = require('path');
const fs = require('fs');
const LRU = require('../LRU');

const cache = new LRU({maxItems: 500});

const PATH_SEP = path.sep === '/' ? '\/' : '\\\\';
const MODULE_FOLDER_REGEX = new RegExp('.*node_modules' + PATH_SEP + '([^' + PATH_SEP + ']*)');

function validStack(stack) {
	return Array.isArray(stack) &&
		typeof stack[0] === 'object' &&
		typeof stack[0].getFileName === 'function';
}

function getRelativeFileName() {
	const filename = this.getFileName();
	if (!filename) return '';
	let root = process.cwd();
	if (root[root.length - 1] !== path.sep) root += path.sep;
	return !~filename.indexOf(root) ? filename : filename.substr(root.length);
}

function getTypeNameSafely() {
	try {
		return this.getTypeName();
	}
	catch (e) {
		// This seems to happen sometimes when using 'use strict',
		// stemming from `getTypeName`.
		// [TypeError: Cannot read property 'constructor' of undefined]
		return null;
	}
}

function getFunctionNameSanitized() {
	const fnName = this.getFunctionName();
	if (fnName) return fnName;
	const typeName = this.getTypeNameSafely();
	if (typeName) return typeName + '.' + (this.getMethodName() || '<anonymous>');
	return '<anonymous>';
}

function getModuleName() {
	const filename = this.getFileName() || '';
	const match = filename.match(MODULE_FOLDER_REGEX);
	if (match) return match[1];
	return '';
}

function isApp() {
	return !this.isNode() && !~(this.getFileName() || '').indexOf('node_modules' + path.sep);
}

function isModule() {
	return !!~(this.getFileName() || '').indexOf('node_modules' + path.sep);
}

function isNode() {
	if (this.isNative()) return true;
	const filename = this.getFileName() || '';
	return (!path.isAbsolute(filename) && filename[0] !== '.');
}

function parseLines(lines, frame, linesOfContext) {
	const lineNo = frame.getLineNumber();
	return {
		pre: lines.slice(Math.max(0, lineNo - (linesOfContext + 1)), lineNo - 1),
		line: lines[lineNo - 1],
		post: lines.slice(lineNo, lineNo + linesOfContext),
	};
}

function getContext(linesOfContext = 5) {
	if (this.context) return this.context;

	const fileName = this.getFileName();
	if (!fileName) return {pre: [], line: '', post: []};

	try {
		let data = fs.readFileSync(fileName, {encoding: 'utf8'});
		data = data.split(/\r?\n/);
		cache.set(fileName, data);
		this.context = parseLines(data, this, linesOfContext);
		return this.context;
	}
	catch (e) {
		return {pre: [], line: '', post: []};
	}
}

function get(error) {
	let stack;
	if (!error) {
		stack = stackTrace.parse(new Error());
		stack.shift();
	}
	else {
		stack = stackTrace.parse(error);
	}

	if (!validStack(stack)) {
		return stack;
	}

	stack.forEach((frame) => {
		frame.getRelativeFileName = getRelativeFileName.bind(frame);
		frame.getTypeNameSafely = getTypeNameSafely.bind(frame);
		frame.getFunctionNameSanitized = getFunctionNameSanitized.bind(frame);
		frame.getModuleName = getModuleName.bind(frame);
		frame.isApp = isApp.bind(frame);
		frame.isModule = isModule.bind(frame);
		frame.isNode = isNode.bind(frame);
		frame.getContext = getContext.bind(frame);
	});
	return stack;
}

module.exports = {
	get,
};
