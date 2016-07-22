/* eslint-disable no-console, no-shadow */
require('./source_map_support');
Error.stackTraceLimit = Infinity;

const stackTrace = require('./stack_trace');
const nodeUtil = require('./node_util_copy');
const chalk = require('chalk');
const _ = require('lodash');

function dumpSingle(arg, options = {}) {
	const opts = _.assign({
		showHidden: false,
		depth: null,
		colors: true,
		breakLength: 1,
	}, options);

	console.log(nodeUtil.inspect(arg, opts));
}

function dump(...args) {
	args.forEach((arg) => {
		dumpSingle(arg);
	});
}

function d(...args) {
	const prevStackLimit = Error.stackTraceLimit;
	Error.stackTraceLimit = 2;

	const stack = stackTrace.get(new Error());
	Error.stackTraceLimit = prevStackLimit;

	const frame = stack[1];
	const fileName = frame.getRelativeFileName();
	const lineNumber = frame.getLineNumber();
	const columnNumber = frame.getColumnNumber();
	const functionName = frame.getFunctionNameSanitized() || 'module';
	const line = _.trim(frame.getContext().line, ' ;');

	console.log(
		chalk.bgBlue(
			' ' +
			chalk.white(
				chalk.bold(fileName) +
				' at ' +
				chalk.bold(lineNumber) +
				':' +
				columnNumber +
				' in ' +
				chalk.bold(functionName)
			) +
			'\n ' +
			chalk.yellow.bold(line)
		)
	);

	dump(args);
	const lineSep = _.repeat('⁻', process.stdout.columns);
	console.log(chalk.blue(lineSep));
}

function trace(error = '') {
	let h1 = 'Tracing';
	let name = error;
	if (_.isError(error)) {
		h1 = error.name;
		name = error.message;
	}

	let stack;
	if (!error) {
		stack = stackTrace.get(new Error());
		stack.shift();
	}
	else {
		stack = stackTrace.get(error);
	}

	let awaitLines = 0;
	let frameNum = 0;

	const h1Length = h1.replace(/\u001b\[\d\d?(;\d\d?)?m/g, '').length;

	if (name.length > process.stdout.columns - h1Length - 3 - name.length) {
		console.log(chalk.bgBlue(chalk.bold(chalk.white(' ' + h1 + ' \n ') + chalk.yellow(name))));
	}
	else {
		const h1Space = _.repeat(' ', process.stdout.columns - h1Length - 2 - name.length);
		console.log(chalk.bgBlue(chalk.white.bold(' ' + h1 + ' ' + chalk.yellow.bold(name) + h1Space)));
	}

	stack.forEach((frame) => {
		frameNum++;
		if (!frame.isApp()) return;

		const fileName = frame.getRelativeFileName();
		const lineNumber = frame.getLineNumber();
		const columnNumber = frame.getColumnNumber();
		let functionName = frame.getFunctionNameSanitized() || 'module';

		if (fileName.indexOf('node_modules') !== -1) return;

		const line = frame.getContext(3).line;
		if (!line) return;

		// Handle Await (Remove Unnecessary Function Calls (4))
		if (awaitLines && awaitLines < 4) {
			if (functionName === 'step' || functionName === '<anonymous>') {
				awaitLines++;
				return;
			}
		}
		else if (awaitLines === 4) {
			awaitLines++;
			return;
		}

		awaitLines = 0;

		if (line.indexOf('await ') !== -1) {
			awaitLines = 1;
			const functionFrame = stack[frameNum + 5];
			if (functionFrame) {
				functionName = functionFrame.getFunctionNameSanitized();
			}
		}

		const header = ` ${fileName} at ${lineNumber}:${columnNumber} in ${functionName}`;
		const headerSpace = _.repeat(' ', process.stdout.columns - header.length);

		const marker = _.repeat(' ', columnNumber - 1) + '^';

		console.log(
			chalk.bgMagenta(
				' ' +
				chalk.white(
					chalk.bold(fileName) +
					' at ' +
					chalk.bold(lineNumber) +
					':' +
					columnNumber +
					' in ' +
					chalk.bold(functionName) +
					headerSpace
				)
			) +
			'\n' +
			chalk.blue.bold(' ' + frame.getContext(3).pre.join('\n ').replace(/\t/g, '    ')) +
			'\n ' +
			chalk.yellow.bold(line.replace(/\t/g, '    ')) +
			'\n ' +
			chalk.yellow.bold(marker) +
			'\n ' +
			chalk.blue.bold(frame.getContext(3).post.join('\n ').replace(/\t/g, '    '))
		);
	});

	const lineSep = _.repeat('⁻', process.stdout.columns);
	console.log(chalk.blue(lineSep));
}

d.trace = trace;
d.getTrace = stackTrace.get;
d.dump = dump;

process.on('uncaughtException', (err) => {
	err.name = chalk.bgRed.white(' FATAL ') + ' ' + err.name;
	d.trace(err);
	process.exit(1);
});

process.on('unhandledRejection', (err) => {
	err.name = chalk.bgRed.white(' UNHANDLED ') + ' ' + err.name;
	d.trace(err);
});

module.exports = d;
