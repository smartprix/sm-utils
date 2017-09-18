function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const _ = require('lodash');
const promisify = require('thenify-all');
const _path = require('path');
const _rimraf = promisify(require('rimraf'));
const _mkdirp = promisify(require('mkdirp'));
const _glob = promisify(require('glob'));
const _chmodr = promisify(require('chmodr'));
const _chownr = promisify(require('chownr'));
const system = require('./system');
const _fs = require('fs');

const fs = promisify(_fs);

class File {
	constructor(path) {
		this.path = path;
	}

	exists() {
		var _this = this;

		return _asyncToGenerator(function* () {
			try {
				yield fs.lstat(_this.path);
				return true;
			} catch (e) {
				return false;
			}
		})();
	}

	existsSync() {
		try {
			_fs.lstatSync(this.path);
			return true;
		} catch (e) {
			return false;
		}
	}

	isFile() {
		var _this2 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this2.path)).isFile();
			} catch (e) {
				return false;
			}
		})();
	}

	isDir() {
		var _this3 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this3.path)).isDirectory();
			} catch (e) {
				return false;
			}
		})();
	}

	mtime() {
		var _this4 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this4.path)).mtime;
			} catch (e) {
				return 0;
			}
		})();
	}

	ctime() {
		var _this5 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this5.path)).ctime;
			} catch (e) {
				return 0;
			}
		})();
	}

	atime() {
		var _this6 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this6.path)).atime;
			} catch (e) {
				return 0;
			}
		})();
	}

	crtime() {
		var _this7 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this7.path)).birthtime;
			} catch (e) {
				return 0;
			}
		})();
	}

	lstat() {
		var _this8 = this;

		return _asyncToGenerator(function* () {
			return fs.lstat(_this8.path);
		})();
	}

	stat() {
		var _this9 = this;

		return _asyncToGenerator(function* () {
			return fs.stat(_this9.path);
		})();
	}

	size() {
		var _this10 = this;

		return _asyncToGenerator(function* () {
			try {
				return (yield fs.lstat(_this10.path)).size;
			} catch (e) {
				return 0;
			}
		})();
	}

	chmod(mode) {
		var _this11 = this;

		return _asyncToGenerator(function* () {
			return fs.chmod(_this11.path, mode);
		})();
	}

	chmodr(mode) {
		var _this12 = this;

		return _asyncToGenerator(function* () {
			return _chmodr(_this12.path, mode);
		})();
	}

	chown(user, group) {
		var _this13 = this;

		return _asyncToGenerator(function* () {
			if (Number.isInteger(user) && Number.isInteger(group)) {
				return fs.chown(_this13.path, user, group);
			}

			return system.execOut(`chown ${user}:${group} ${_this13.path}`);
		})();
	}

	chownr(user, group) {
		var _this14 = this;

		return _asyncToGenerator(function* () {
			if (Number.isInteger(user) && Number.isInteger(group)) {
				return _chownr(_this14.path, user, group);
			}

			return system.execOut(`chown -R ${user}:${group} ${_this14.path}`);
		})();
	}

	rename(newName) {
		var _this15 = this;

		return _asyncToGenerator(function* () {
			return fs.rename(_this15.path, newName);
		})();
	}

	mv(newName) {
		var _this16 = this;

		return _asyncToGenerator(function* () {
			return _this16.rename(_this16.path, newName);
		})();
	}

	unlink() {
		var _this17 = this;

		return _asyncToGenerator(function* () {
			return fs.unlink(_this17.path);
		})();
	}

	rm() {
		var _this18 = this;

		return _asyncToGenerator(function* () {
			return _this18.unlink();
		})();
	}

	rmdir() {
		var _this19 = this;

		return _asyncToGenerator(function* () {
			return fs.rmdir(_this19.path);
		})();
	}

	rmrf() {
		var _this20 = this;

		return _asyncToGenerator(function* () {
			return _rimraf(_this20.path);
		})();
	}

	mkdir(mode = 0o755) {
		var _this21 = this;

		return _asyncToGenerator(function* () {
			return fs.mkdir(_this21.path, mode);
		})();
	}

	mkdirp(mode = 0o755) {
		var _this22 = this;

		return _asyncToGenerator(function* () {
			return _mkdirp(_this22.path, mode);
		})();
	}

	glob() {
		var _this23 = this;

		return _asyncToGenerator(function* () {
			return _glob(_this23.path);
		})();
	}

	read() {
		var _this24 = this;

		return _asyncToGenerator(function* () {
			return fs.readFile(_this24.path, 'utf8');
		})();
	}

	mkdirpPath(mode = 0o755) {
		var _this25 = this;

		return _asyncToGenerator(function* () {
			return _mkdirp(_path.dirname(_this25.path), mode);
		})();
	}

	write(contents, options = {}) {
		var _this26 = this;

		return _asyncToGenerator(function* () {
			const opts = _.assign({
				fileMode: 0o644,
				dirMode: 0o755,
				retries: 0
			}, options);

			if (!opts.retries) {
				yield _this26.mkdirpPath(opts.dirMode);
				return fs.writeFile(_this26.path, contents, { encoding: 'utf8', mode: opts.fileMode });
			}

			try {
				return _this26.write(contents, _.assign(opts, { retries: 0 }));
			} catch (e) {
				opts.retries--;
				return _this26.write(contents, opts);
			}
		})();
	}

	append(contents, options = {}) {
		var _this27 = this;

		return _asyncToGenerator(function* () {
			const opts = _.assign({
				fileMode: 0o644,
				dirMode: 0o755,
				retries: 0
			}, options);

			if (!opts.retries) {
				yield _this27.mkdirpPath(opts.dirMode);
				return fs.appendFile(_this27.path, contents, { encoding: 'utf8', mode: opts.fileMode });
			}

			try {
				return _this27.append(contents, _.assign(opts, { retries: 0 }));
			} catch (e) {
				opts.retries--;
				return _this27.append(contents, opts);
			}
		})();
	}

	copy(destination, options = {}) {
		var _this28 = this;

		return _asyncToGenerator(function* () {
			const opts = _.assign({
				overwrite: true
			}, options);

			if (opts.overwrite) {
				return fs.copyFile(_this28.path, destination);
			}

			return fs.copyFile(_this28.path, destination, fs.constants.COPYFILE_EXCL);
		})();
	}

	realpath() {
		var _this29 = this;

		return _asyncToGenerator(function* () {
			return fs.realpath(_this29.path);
		})();
	}

	realpathSync() {
		return _fs.realpathSync(this.path);
	}
}

function file(path) {
	return new File(path);
}

module.exports = file;