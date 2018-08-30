/* eslint-disable no-console, no-shadow */
import System from '../System';

// increase error stack trace limit
Error.stackTraceLimit = 30;

const stackTrace = require('./stack_trace');
const nodeUtil = require('./node_util_copy');
const chalk = require('chalk');
const _ = require('lodash');

function errorFrameToString(frame, background = 'magenta', foreground = 'white') {
	const fileName = frame.getRelativeFileName();

	if (!fileName) {
		return chalk.bgYellow(
			' ' +
			chalk.black.bold(
				_.repeat('-', process.stdout.columns - 2)
			)
		);
	}

	const lineNumber = frame.getLineNumber();
	const columnNumber = frame.getColumnNumber();
	const functionName = frame.getFunctionNameSanitized() || 'module';

	const header = ` ${fileName} at ${lineNumber}:${columnNumber} in ${functionName}`;
	const headerSpace = _.repeat(' ', process.stdout.columns - header.length);

	return chalk[`bg${_.upperFirst(background)}`](
		' ' +
		chalk[foreground](
			chalk.bold(fileName) +
			' at ' +
			chalk.bold(lineNumber) +
			':' +
			columnNumber +
			' in ' +
			chalk.bold(functionName) +
			headerSpace
		)
	);
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

	// eslint-disable-next-line no-control-regex
	const h1Length = h1.replace(/\u001b\[\d\d?(;\d\d?)?m/g, '').length;

	if (name.length > process.stdout.columns - h1Length - 3 - name.length) {
		console.log(chalk.bgBlue(chalk.bold(chalk.white(' ' + h1 + ' \n ') + chalk.yellow(name))));
	}
	else {
		const h1Space = _.repeat(' ', process.stdout.columns - h1Length - 2 - name.length);
		console.log(chalk.bgBlue(chalk.white.bold(' ' + h1 + ' ' + chalk.yellow.bold(name) + h1Space)));
	}

	stack.forEach((frame) => {
		const fileName = frame.getRelativeFileName();
		const columnNumber = frame.getColumnNumber();

		if (!frame.isApp() || fileName.indexOf('node_modules') !== -1) {
			console.log(errorFrameToString(frame, 'black', 'white'));
			return;
		}


		const line = frame.getContext(3).line;
		if (!line) {
			console.log(errorFrameToString(frame, 'black', 'white'));
			return;
		}

		const marker = _.repeat(' ', columnNumber - 1) + '^';

		console.log(
			errorFrameToString(frame, 'magenta', 'white') +
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

function dumpSingle(arg, options = {}) {
	if (arg instanceof Error) {
		trace(arg);
		return;
	}

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

/**
 * Colored Log to console with stack trace
 * @param  {Array<any>} args Args to log to console
 */
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
	const line = _.trim(frame.getContext().line, ' \t\n;');

	const upperLine = `${fileName} at ${lineNumber}:${columnNumber} in ${functionName}`;
	const upperExtraSpace = _.repeat(' ', Math.max(0, process.stdout.columns - upperLine.length - 1));
	const lowerExtraSpace = _.repeat(' ', Math.max(0, process.stdout.columns - line.length - 1));

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
			upperExtraSpace +
			'\n ' +
			chalk.yellow.bold(line) +
			lowerExtraSpace
		)
	);

	args.forEach((arg) => {
		dumpSingle(arg);
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
	System.exit(1);
});

process.on('unhandledRejection', (err) => {
	err.name = chalk.bgRed.white(' UNHANDLED ') + ' ' + err.name;
	d.trace(err);
});

module.exports = d;
