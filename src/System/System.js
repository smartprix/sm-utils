import childProcess from 'child_process';
import passwd from 'etc-passwd';
import util from 'util';
import Vachan from '../Vachan';
import gracefulServerShutdown from './gracefulServerShutdown';

/**
 * System and process utilities
 * @namespace System
 */

const setImmediatePromise = util.promisify(setImmediate);
const setTimeoutPromise = util.promisify(setTimeout);

let oldUmask = -1;
let hrtimeDelta;

// assign properties to global to avoid issues in case of multiple sm-utils in node_modules
// NOTE: don't change globalDataKey or globalData properties
// it should be consistent across multiple sm-utils versions
const globalDataKey = '_SmUtils_System';
if (!global[globalDataKey]) global[globalDataKey] = {};

/**
 * @type {object}
 * @memberof System
 * @private
 */
const globalData = global[globalDataKey];

globalData.processExit = globalData.processExit || process.exit.bind(process);
globalData.onExitHandlers = globalData.onExitHandlers || [];
globalData.exitCalled = globalData.exitCalled || false;

/**
 * @typedef {object} processObject
 * @property {ChildProcess} childProcess
 * @property {Buffer} stdout
 * @property {Buffer} stderr
 */

/**
  * @ignore
  * @param {string} method which method of childProcess to call, 'exec', 'spawn'
  * @param {Array<any>} args
  * @return {Promise<processObject>}
  */
async function execWrapper(method, args) {
	return new Promise((resolve, reject) => {
		let cp;

		// add callback to arguments
		args.push((err, stdout, stderr) => {
			if (err) {
				const commandStr = args[0] + (Array.isArray(args[1]) ? (' ' + args[1].join(' ')) : '');
				err.message += ' `' + commandStr + '` (exited with error code ' + err.code + ')';
				err.stdout = stdout;
				err.stderr = stderr;
				reject(err);
			}
			else {
				resolve({
					childProcess: cp,
					stdout,
					stderr,
				});
			}
		});

		cp = childProcess[method](...args);
	});
}

/**
 * Execute the given command in a shell.
 * @memberof System
 * @param {string} command
 * @param {object} options options object
 * options: {timeout (in ms), cwd, uid, gid, env (object), shell (eg. /bin/sh), encoding}
 * @return {Promise<processObject>}
 */
async function exec(...args) {
	return execWrapper('exec', args);
}

/**
 * Similar to exec but instead executes a given file
 * @memberof System
 * @param {Array<any>} args
 * @return {Promise<processObject>}
 */
async function execFile(...args) {
	return execWrapper('execFile', args);
}

/**
 * execute a command and return its output
 *
 * @memberof System
 * @param {Array<any>} args
 * @return {string} output of the command's execution
 */
async function execOut(...args) {
	return (await exec.apply(this, args)).stdout.toString();
}

/**
 * execute a file and return its output
 *
 * @memberof System
 * @param {Array<any>} args
 * @return {string} output of the file's execution
 */
async function execFileOut(...args) {
	return (await execFile.apply(this, args)).stdout.toString();
}


/**
 * turn off umask for the current process
 * @memberof System
 * @return {number} the old umask
 */
function noUmask() {
	oldUmask = process.umask(0);
	return oldUmask;
}

/**
 * restores (turns on) the previous umask
 * @memberof System
 * @return {number} new umask
 */
function yesUmask() {
	let newUmask = -1;
	if (oldUmask >= 0) {
		newUmask = process.umask(oldUmask);
	}
	return newUmask;
}

/**
 * get the uid of the user running current process
 *
 * @memberof System
 * @return {number}  uid
 */
function getuid() {
	return process.getuid();
}

/**
 * get user info from username or uid
 * currently gets user info from /etc/passwd
 *
 * @memberof System
 * @param  {string|number} user username or uid
 * @return {object}             the user's information
 */
async function getUserInfo(user) {
	user = (user === undefined) ? process.getuid() : user;
	let opts;

	if (Number.isInteger(user)) {
		opts = {uid: user};
	}
	else {
		opts = {username: user};
	}

	return new Promise((resolve, reject) => {
		passwd.getUser(opts, (err, userObj) => {
			if (err) reject(err);
			else resolve(userObj);
		});
	});
}

/**
 * get all users in the system
 * currently gets user info from /etc/passwd
 *
 * @memberof System
 * @return {object}  object containing info for all users, as username:info pairs
 */
async function getAllUsers() {
	return new Promise((resolve, reject) => {
		passwd.getUsers((err, users) => {
			if (err) {
				reject(err);
				return;
			}

			const usersObj = {};
			users.forEach((user) => {
				usersObj[user.username] = user;
			});

			resolve(usersObj);
		});
	});
}

/**
 * get current time in seconds
 *
 * @memberof System
 * @return {number}  current time in seconds
 */
function time() {
	return Math.floor(Date.now() / 1000);
}

/**
 * get current time in milliseconds (as double)
 *
 * @memberof System
 * @return {number}  current time in milliseconds
 */
function millitime() {
	return (Date.now() / 1000);
}

/**
 * get current time in nanoseconds (as double)
 *
 * @memberof System
 * @return {number}  current time in nanoseconds
 */
function nanotime() {
	const hrtime = process.hrtime();
	const hrtimeFloat = Number(hrtime[0] + '.' + hrtime[1]);
	hrtimeDelta = hrtimeDelta || (millitime() - hrtimeFloat);
	return hrtimeDelta + hrtimeFloat;
}

/**
 * get current time in microseconds (as double)
 *
 * @memberof System
 * @return {number}  current time in microseconds
 */
function microtime() {
	return nanotime();
}

/**
 * exit and kill the process gracefully (after completing all onExit handlers)
 * code can be an exit code or a message (string)
 * if a message is given then it will be logged to console before exiting
 *
 * @memberof System
 * @param {number|string} code exit code or the message to be logged
 * @return {void}
 */
function exit(code) {
	if (code === undefined || Number.isInteger(code)) {
		// eslint-disable-next-line no-use-before-define
		return _exitHandler({exitCode: code});
	}

	// eslint-disable-next-line no-use-before-define
	return _exitHandler({exitCode: code});
}

/**
 * force exit the process
 * no onExit handler will run when force exiting a process
 * same as original process.exit (which we override)
 *
 * @memberof System
 * @param {number|string} code exit code or the message to be logged
 * @return {void}
 */
function forceExit(code) {
	if (code === undefined || Number.isInteger(code)) {
		return globalData.processExit(code);
	}

	console.log(code);
	return globalData.processExit(0);
}

function _exitHandler(options = {}) {
	if (globalData.exitCalled) {
		return;
	}
	globalData.exitCalled = true;

	const promises = [];
	const exitHandlers = globalData.onExitHandlers;

	exitHandlers.forEach((handler) => {
		let result;
		try {
			result = handler.callback();
		}
		catch (e) {
			console.error(e);
		}

		if (result && result.then) {
			promises.push(Vachan.timeout(result, handler.options.timeout));
		}
	});

	let promisesPending = promises.length;
	if (!promisesPending) {
		forceExit(options.exitCode || 0);
	}

	promises.forEach((promise) => {
		promise.then(() => {
			promisesPending--;
			if (!promisesPending) {
				forceExit(options.exitCode || 0);
			}
		}, (e) => {
			promisesPending--;
			console.error(e);
			if (!promisesPending) {
				forceExit(options.exitCode || 0);
			}
		});
	});
}

/**
 * @typedef {object} timeoutOpts
 * @property {number} [timeout=10000] Milliseconds before timing out (default 10000)
 */

/**
 * Add an exit handler that runs when process receives an exit signal
 * callback can be an async function, process will exit when all handlers have completed
 * @memberof System
 * @param {function} callback function to call on exit
 * @param {number|timeoutOpts} [options={}] can be {timeout} or a number
 * @return {Promise<void>}
 */
function onExit(callback, options = {}) {
	if (typeof options === 'number') {
		options = {timeout: options};
	}
	else if (!options || typeof options !== 'object') {
		throw new TypeError('Incorrect options format, must be an object or a number');
	}

	// set default timeout of 10s
	options.timeout = options.timeout || 10000;

	const exitHandlers = globalData.onExitHandlers;
	exitHandlers.push({
		callback,
		options,
	});

	// only set handlers first time
	if (exitHandlers.length === 1) {
		process.once('SIGINT', _exitHandler);
		process.once('SIGTERM', _exitHandler);

		// override process.exit to not immediately exit
		// but to exit after waiting for exit handlers to complete
		// this is because some other library might call process.exit
		// which we have no control over (like graceful-http-shutdown)
		process.exit = exit;
	}
}

/**
 * install graceful server exit handler on a tcp server
 * this will make sure that the process exits only
 * after all the current requests are served
 * @memberof System
 * @param {*} server
 * @param {number|timeoutOpts} [options={}]
 */
function gracefulServerExit(server, options = {}) {
	onExit(gracefulServerShutdown(server), options);
}

/**
 * set the max memory that the current node process can use
 * @memberof System
 * @param {number} memory max memory in megabytes
 */
function setMaxMemory(memory) {
	if (typeof memory !== 'number') {
		throw new TypeError('memory must be a number');
	}
	if (memory < 128) {
		throw new TypeError('memory is too low, must be >= 128');
	}

	// eslint-disable-next-line global-require
	const v8 = require('v8');
	const memoryInt = Math.floor(memory);
	v8.setFlagsFromString(`--max_old_space_size=${memoryInt}`);
}

/**
 * get the current git branch name (in cwd)
 * @memberof System
 * @returns {string} the current branch name, empty string if not found
 */
async function getGitBranch() {
	try {
		const branch = (await execOut('git symbolic-ref --short HEAD')).trim();
		return branch || '';
	}
	catch (e) {
		return '';
	}
}

module.exports = {
	_globalData: globalData,
	exec,
	execFile,
	execOut,
	execFileOut,
	noUmask,
	yesUmask,
	getuid,
	getUserInfo,
	getAllUsers,
	time,
	millitime,
	microtime,
	nanotime,
	/**
	 * Sleep for a specified time (in milliseconds)
	 *   Example: await System.sleep(2000);
	 * @memberof System
	 * @return {Promise<void>}
	 */
	sleep: setTimeoutPromise,
	/**
	 * wait till the next event loop cycle
	 * this function is useful if we are running a long blocking task
	 * and need to make sure that other callbacks can complete.
	 * @memberof System
	 * @return {Promise<void>}
	 */
	tick: setImmediatePromise,
	exit,
	forceExit,
	onExit,
	gracefulServerExit,
	setMaxMemory,
	getGitBranch,
};
