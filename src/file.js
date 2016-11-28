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

class File
{
	constructor(path) {
		this.path = path;
	}

	async exists() {
		try {
			await fs.lstat(this.path);
			return true;
		}
		catch (e) {
			return false;
		}
	}

	existsSync() {
		try {
			_fs.lstatSync(this.path);
			return true;
		}
		catch (e) {
			return false;
		}
	}

	async isFile() {
		try {
			return (await fs.lstat(this.path)).isFile();
		}
		catch (e) {
			return false;
		}
	}

	async isDir() {
		try {
			return (await fs.lstat(this.path)).isDirectory();
		}
		catch (e) {
			return false;
		}
	}

	async mtime() {
		try {
			return (await fs.lstat(this.path)).mtime;
		}
		catch (e) {
			return 0;
		}
	}

	async ctime() {
		try {
			return (await fs.lstat(this.path)).ctime;
		}
		catch (e) {
			return 0;
		}
	}

	async atime() {
		try {
			return (await fs.lstat(this.path)).atime;
		}
		catch (e) {
			return 0;
		}
	}

	async crtime() {
		try {
			return (await fs.lstat(this.path)).birthtime;
		}
		catch (e) {
			return 0;
		}
	}

	async chmod(mode) {
		return fs.chmod(this.path, mode);
	}

	async chmodr(mode) {
		return _chmodr(this.path, mode);
	}

	async chown(user, group) {
		if (Number.isInteger(user) && Number.isInteger(group)) {
			return fs.chown(this.path, user, group);
		}

		return system.execOut(`chown ${user}:${group} ${this.path}`);
	}

	async chownr(user, group) {
		if (Number.isInteger(user) && Number.isInteger(group)) {
			return _chownr(this.path, user, group);
		}

		return system.execOut(`chown -R ${user}:${group} ${this.path}`);
	}

	async rename(newName) {
		return fs.rename(this.path, newName);
	}

	async mv(newName) {
		return this.rename(this.path, newName);
	}

	async unlink() {
		return fs.unlink(this.path);
	}

	async rm() {
		return this.unlink();
	}

	async rmdir() {
		return fs.rmdir(this.path);
	}

	async rmrf() {
		return _rimraf(this.path);
	}

	async mkdir(mode = 0o755) {
		return fs.mkdir(this.path, mode);
	}

	async mkdirp(mode = 0o755) {
		return _mkdirp(this.path, mode);
	}

	async glob() {
		return _glob(this.path);
	}

	async read() {
		return fs.readFile(this.path, 'utf8');
	}

	async mkdirpPath(mode = 0o755) {
		return _mkdirp(_path.dirname(this.path), mode);
	}

	async write(contents, options = {}) {
		const opts = _.assign({
			fileMode: 0o644,
			dirMode: 0o755,
			retries: 0,
		}, options);

		if (!opts.retries) {
			await this.mkdirpPath(opts.dirMode);
			return fs.writeFile(this.path, contents, {encoding: 'utf8', mode: opts.fileMode});
		}

		try {
			return this.write(contents, _.assign(opts, {retries: 0}));
		}
		catch (e) {
			opts.retries--;
			return this.write(contents, opts);
		}
	}

	async append(contents, options = {}) {
		const opts = _.assign({
			fileMode: 0o644,
			dirMode: 0o755,
			retries: 0,
		}, options);

		if (!opts.retries) {
			await this.mkdirpPath(opts.dirMode);
			return fs.appendFile(this.path, contents, {encoding: 'utf8', mode: opts.fileMode});
		}

		try {
			return this.append(contents, _.assign(opts, {retries: 0}));
		}
		catch (e) {
			opts.retries--;
			return this.append(contents, opts);
		}
	}

	async realpath() {
		return fs.realpath(this.path);
	}

	realpathSync() {
		return _fs.realpathSync(this.path);
	}
}

function file(path) {
	return new File(path);
}

module.exports = file;
