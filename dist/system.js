

// execute a command and return its output
let execOut = (() => {
	var _ref = _asyncToGenerator(function* (...args) {
		return (yield exec.apply(this, args)).stdout.toString();
	});

	return function execOut() {
		return _ref.apply(this, arguments);
	};
})();

// execute a file and return its output


let execFileOut = (() => {
	var _ref2 = _asyncToGenerator(function* (...args) {
		return (yield execFile.apply(this, args)).stdout.toString();
	});

	return function execFileOut() {
		return _ref2.apply(this, arguments);
	};
})();

// turn off umask for the current process
// returns the old umask


function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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
				const commandStr = args[0] + (Array.isArray(args[1]) ? ' ' + args[1].join(' ') : '');
				err.message += ' `' + commandStr + '` (exited with error code ' + err.code + ')';
				err.stdout = stdout;
				err.stderr = stderr;
				reject(err);
			} else {
				resolve({
					childProcess: cp,
					stdout,
					stderr
				});
			}
		});

		cp = childProcess[method](...args);
	});
}

// execute the given command in a shell
// first argument is the command itself
// second argument is an options object
// options: {timeout (in ms), cwd, uid, gid, env (object), shell (eg. /bin/sh), encoding}
function exec(...args) {
	return execWrapper('exec', args);
}

// similar to exec but instead executes a given file
function execFile(...args) {
	return execWrapper('execFile', args);
}function noUmask() {
	oldUmask = process.umask(0);
	return oldUmask;
}

// restores (turns on) the previous umask
function yesUmask() {
	let newUmask = -1;
	if (oldUmask >= 0) {
		newUmask = process.umask(oldUmask);
	}
	return newUmask;
}

// get the uid of the user running current process
function getuid() {
	return process.getuid();
}

// get user info from username or uid
// currently gets user info from /etc/passwd
function getUserInfo(user) {
	user = user === undefined ? process.getuid() : user;
	let opts;

	if (Number.isInteger(user)) {
		opts = { uid: user };
	} else {
		opts = { username: user };
	}

	return new Promise((resolve, reject) => {
		passwd.getUser(opts, (err, userObj) => {
			if (err) reject(err);else resolve(userObj);
		});
	});
}

// get all users in the system
// currently gets user info from /etc/passwd
function getAllUsers() {
	return new Promise((resolve, reject) => {
		passwd.getUsers((err, users) => {
			if (err) {
				reject(err);
				return;
			}

			const usersObj = {};
			users.forEach(user => {
				usersObj[user.username] = user;
			});

			resolve(usersObj);
		});
	});
}

// get current time in seconds
function time() {
	return Math.floor(Date.now() / 1000);
}

// get current time in milliseconds (as double)
function millitime() {
	return Date.now() / 1000;
}

// get current time in nanoseconds (as double)
function nanotime() {
	const hrtime = process.hrtime();
	const hrtimeFloat = Number(hrtime[0] + '.' + hrtime[1]);
	hrtimeDelta = hrtimeDelta || millitime() - hrtimeFloat;
	return hrtimeDelta + hrtimeFloat;
}

// get current time in microseconds (as double)
function microtime() {
	return nanotime();
}

// Sleep for a specified time (in milliseconds)
// Example: await system.sleep(2000);
function sleep(timeout) {
	return new Promise(resolve => {
		setTimeout(resolve, timeout);
	});
}

// wait till the next event loop cycle
// this function is useful if we are running a long blocking task
// and need to make sure that other callbacks can complete.
function tick() {
	return new Promise(resolve => {
		setImmediate(resolve);
	});
}

// exit and kill the process
// code can be an exit code or a message (string)
// if a message is given then it will be logged to console before exiting
function exit(code) {
	if (code === undefined || Number.isInteger(code)) {
		return process.exit(code);
	}

	console.log(code); // eslint-disable-line
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
	exit
};