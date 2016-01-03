'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } step("next"); }); }; }

var childProcess = require('child_process');
var passwd = require('etc-passwd');

var old_mask = -1;

function exec_wrapper(method, args) {
    return new Promise(function (resolve, reject) {
        var cp;
        args = [].slice.call(args, 0);

        // add callback to arguments
        args.push(function (err, stdout, stderr) {
            if (err) {
                var commandStr = args[0] + (Array.isArray(args[1]) ? ' ' + args[1].join(' ') : '');
                err.message += ' `' + commandStr + '` (exited with error code ' + err.code + ')';
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            } else {
                resolve({
                    childProcess: cp,
                    stdout: stdout,
                    stderr: stderr
                });
            }
        });

        cp = childProcess[method].apply(childProcess, args);
    });
}

function exec() {
    return exec_wrapper('exec', arguments);
}

function execFile() {
    return exec_wrapper('execFile', arguments);
}

var execOut = (function () {
    var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var _args = arguments;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return exec.apply(this, _args);

                    case 2:
                        return _context.abrupt('return', _context.sent.stdout.toString());

                    case 3:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function execOut() {
        return ref.apply(this, arguments);
    };
})();

var execFileOut = (function () {
    var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var _args2 = arguments;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.next = 2;
                        return execFile.apply(this, _args2);

                    case 2:
                        return _context2.abrupt('return', _context2.sent.stdout.toString());

                    case 3:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function execFileOut() {
        return ref.apply(this, arguments);
    };
})();

function noUmask() {
    old_mask = process.umask(0);
    return old_mask;
}

function yesUmask() {
    var new_mask = -1;
    if (old_mask >= 0) new_mask = process.umask(old_mask);
    return new_mask;
}

function getuid() {
    return process.getuid();
}

// get user info from username or uid
// currently gets user info from /etc/passwd
function getUserInfo(user) {
    user = user === undefined ? process.getuid() : user;
    if (Number.isInteger(user)) {
        opts = { uid: user };
    } else {
        opts = { username: user };
    }

    return new Promise(function (resolve, reject) {
        passwd.getUser(opts, function (err, user) {
            if (err) reject(err);else resolve(user);
        });
    });
}

// code can be an exit code or a message (string)
// if a message is given then it will be logged to console before exiting:w
function exit(code) {
    if (code === undefined || Number.isInteger(code)) return process.exit(code);

    console.log(code);
    return process.exit(0);
}

module.exports = {
    exec: exec,
    execFile: execFile,
    execOut: execOut,
    execFileOut: execFileOut,
    noUmask: noUmask,
    yesUmask: yesUmask,
    getuid: getuid,
    getUserInfo: getUserInfo,
    exit: exit
};