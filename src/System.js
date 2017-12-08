const childProcess = require('child_process');
const passwd = require('etc-passwd');

let oldUmask = -1;
let hrtimeDelta;

function execWrapper(method, args) {
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
 *
 * @param  {Array} args
 * first argument is the command itself
 * second argument is an options object
 * options: {timeout (in ms), cwd, uid, gid, env (object), shell (eg. /bin/sh), encoding}
 *
 */
function exec(...args) {
	return execWrapper('exec', args);
}

/**
 * Similar to exec but instead executes a given file
 */
function execFile(...args) {
	return execWrapper('execFile', args);
}

/**
 * execute a command and return its output
 *
 * @return {String} output of the command's execution
 */
async function execOut(...args) {
	return (await exec.apply(this, args)).stdout.toString();
}

/**
 * execute a file and return its output
 *
 * @return {String} output of the file's execution
 */
async function execFileOut(...args) {
	return (await execFile.apply(this, args)).stdout.toString();
}


/**
 * turn off umask for the current process
 * returns the old umask
 */
function noUmask() {
	oldUmask = process.umask(0);
	return oldUmask;
}

/**
 * restores (turns on) the previous umask
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
 * @return {Number}  uid
 */
function getuid() {
	return process.getuid();
}

/**
 * get user info from username or uid
 * currently gets user info from /etc/passwd
 *
 * @param  {String|Number} user username or uid
 * @return {Object}             the user's information
 */
function getUserInfo(user) {
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
 * @return {Object}  object containing info for all users, as username:info pairs
 */
function getAllUsers() {
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
 * @return {Number}  current time in seconds
 */
function time() {
	return Math.floor(Date.now() / 1000);
}

/**
 * get current time in milliseconds (as double)
 *
 * @return {Number}  current time in milliseconds
 */
function millitime() {
	return (Date.now() / 1000);
}

/**
 * get current time in nanoseconds (as double)
 *
 * @return {Number}  current time in nanoseconds
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
 * @return {Number}  current time in microseconds
 */
function microtime() {
	return nanotime();
}

/**
 * Sleep for a specified time (in milliseconds)
 *   Example: await System.sleep(2000);
 */
function sleep(timeout) {
	return new Promise((resolve) => {
		setTimeout(resolve, timeout);
	});
}

/**
 * wait till the next event loop cycle
 * this function is useful if we are running a long blocking task
 * and need to make sure that other callbacks can complete.
 */
function tick() {
	return new Promise((resolve) => {
		setImmediate(resolve);
	});
}

/**
 * exit and kill the process
 * code can be an exit code or a message (string)
 * if a message is given then it will be logged to console before exiting
 *
 * @param {int|String} code exit code or the message to be logged
 */
function exit(code) {
	if (code === undefined || Number.isInteger(code)) {
		return process.exit(code);
	}

	console.log(code);		// eslint-disable-line
	return process.exit(0);
}

module.exports = {
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
	sleep,
	tick,
	exit,
};
