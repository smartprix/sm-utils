var promisify = require("thenify-all");
var fs = promisify(require("fs"));
var path = require("path");
var _rimraf = promisify(require("rimraf"));
var _mkdirp = promisify(require("mkdirp"));
var _glob = promisify(require("glob"));
var _chmodr = promisify(require("chmodr"));
var _chownr = promisify(require("chownr"));
var system = require("./system");

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
        catch(e) {
            return false;
        }
    }

    async isFile() {
        try {
            return (await fs.lstat(this.path)).isFile();
        }
        catch(e) {
            return false;
        }
    }

    async isDir() {
        try {
            return (await fs.lstat(this.path)).isDirectory();
        }
        catch(e) {
            return false;
        }
    }

    async mtime() {
        try {
            return (await fs.lstat(this.path)).mtime;
        }
        catch(e) {
            return 0;
        }
    }

    async ctime() {
        try {
            return (await fs.lstat(this.path)).ctime;
        }
        catch(e) {
            return 0;
        }
    }

    async atime() {
        try {
            return (await fs.lstat(this.path)).atime;
        }
        catch(e) {
            return 0;
        }
    }

    async crtime() {
        try {
            return (await fs.lstat(this.path)).birthtime;
        }
        catch(e) {
            return 0;
        }
    }

    async chmod(mode) {
        return await fs.chmod(this.path, mode);
    }

    async chmodr(mode) {
        return await _chmodr(this.path, mode);
    }

    async chown(user, group) {
        if(Number.isInteger(user) && Number.isInteger(group)) {
            return await fs.chown(this.path, user, group);
        }

        return await system.execOut(`chown ${user}:${group} ${this.path}`);
    }

    async chownr(user, group) {
        if(Number.isInteger(user) && Number.isInteger(group)) {
            return await _chownr(this.path, user, group);
        }

        return await system.execOut(`chown -R ${user}:${group} ${this.path}`);
    }

    async rename(new_name) {
        return await fs.rename(this.path, new_name);
    }

    async unlink() {
        return await fs.unlink(this.path);
    }

    async rm() {
        return await this.unlink();
    }

    async rmdir() {
        return await fs.rmdir(this.path);
    }

    async rmrf() {
        return await _rimraf(this.path);
    }

    async mkdir(mode) {
        mode = mode || 0o755;
        return await fs.mkdir(this.path, mode);
    }

    async mkdirp(mode) {
        return await _mkdirp(this.path, mode);
    }

    async glob() {
        return await _glob(this.path);
    }

    async read() {
        return await fs.readFile(this.path, 'utf8');
    }

    async mkdirp_path(mode) {
        mode = mode || 0o755;
        return await _mkdirp(path.dirname(this.path), mode);
    }

    async write(contents, file_mode, dir_mode) {
        dir_mode = dir_mode || 0o755;
        file_mode = file_mode || 0o644;

        await this.mkdirp_path(dir_mode);
        return await fs.writeFile(this.path, contents, {encoding: 'utf8', mode: file_mode});
    }

    async append(contents, file_mode, dir_mode) {
        dir_mode = dir_mode || 0o755;
        file_mode = file_mode || 0o644;

        await this.mkdirp_path(dir_mode);
        return await fs.appendFile(this.path, contents, {encoding: 'utf8', mode: file_mode});
    }

    async realpath() {
        return await fs.realpath(this.path);
    }
}

function file(path) {
    return new File(path);
}

module.exports = file;
