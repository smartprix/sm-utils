var childProcess = require('child_process');
var passwd = require('etc-passwd');

var old_mask = -1;

function exec_wrapper(method, args) {
    return new Promise(function(resolve, reject) {
        var cp;
        args = [].slice.call(args, 0);

        // add callback to arguments
        args.push(function (err, stdout, stderr) {
            if (err) {
                var commandStr = args[0] + (Array.isArray(args[1]) ? (' ' + args[1].join(' ')) : '');
                err.message += ' `' + commandStr + '` (exited with error code ' + err.code + ')';
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            }
            else {
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

async function execOut() {
    return (await exec.apply(this, arguments)).stdout.toString();
}

async function execFileOut() {
    return (await execFile.apply(this, arguments)).stdout.toString();
}

function noUmask() {
    old_mask = process.umask(0);
    return old_mask;
}

function yesUmask() {
    var new_mask = -1;
    if(old_mask >= 0)
        new_mask = process.umask(old_mask);
    return new_mask;
}

function getuid() {
    return process.getuid();
}

// get user info from username or uid
// currently gets user info from /etc/passwd
function getUserInfo(user) {
    user = user === undefined ? process.getuid() : user;
    if(Number.isInteger(user)) {
        opts = {uid: user};
    }
    else {
        opts = {username: user};
    }

    return new Promise(function(resolve, reject) {
        passwd.getUser(opts, function(err, user) {
            if(err) reject(err);
            else resolve(user);
        });
    });
}

// code can be an exit code or a message (string)
// if a message is given then it will be logged to console before exiting:w
function exit(code) {
    if(code === undefined || Number.isInteger(code))
        return process.exit(code);

    console.log(code);
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
    exit
}
