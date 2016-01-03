"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var promisify = require("thenify-all");
var fs = promisify(require("fs"));
var path = require("path");
var _rimraf = promisify(require("rimraf"));
var _mkdirp = promisify(require("mkdirp"));
var _glob = promisify(require("glob"));
var _chmodr = promisify(require("chmodr"));
var _chownr = promisify(require("chownr"));
var system = require("./system");

var File = (function () {
    function File(path) {
        _classCallCheck(this, File);

        this.path = path;
    }

    _createClass(File, [{
        key: "exists",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                _context.prev = 0;
                                _context.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context.abrupt("return", true);

                            case 6:
                                _context.prev = 6;
                                _context.t0 = _context["catch"](0);
                                return _context.abrupt("return", false);

                            case 9:
                            case "end":
                                return _context.stop();
                        }
                    }
                }, _callee, this, [[0, 6]]);
            }));

            return function exists() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "isFile",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _context2.prev = 0;
                                _context2.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context2.abrupt("return", _context2.sent.isFile());

                            case 6:
                                _context2.prev = 6;
                                _context2.t0 = _context2["catch"](0);
                                return _context2.abrupt("return", false);

                            case 9:
                            case "end":
                                return _context2.stop();
                        }
                    }
                }, _callee2, this, [[0, 6]]);
            }));

            return function isFile() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "isDir",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _context3.prev = 0;
                                _context3.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context3.abrupt("return", _context3.sent.isDirectory());

                            case 6:
                                _context3.prev = 6;
                                _context3.t0 = _context3["catch"](0);
                                return _context3.abrupt("return", false);

                            case 9:
                            case "end":
                                return _context3.stop();
                        }
                    }
                }, _callee3, this, [[0, 6]]);
            }));

            return function isDir() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "mtime",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                _context4.prev = 0;
                                _context4.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context4.abrupt("return", _context4.sent.mtime);

                            case 6:
                                _context4.prev = 6;
                                _context4.t0 = _context4["catch"](0);
                                return _context4.abrupt("return", 0);

                            case 9:
                            case "end":
                                return _context4.stop();
                        }
                    }
                }, _callee4, this, [[0, 6]]);
            }));

            return function mtime() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "ctime",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
                return regeneratorRuntime.wrap(function _callee5$(_context5) {
                    while (1) {
                        switch (_context5.prev = _context5.next) {
                            case 0:
                                _context5.prev = 0;
                                _context5.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context5.abrupt("return", _context5.sent.ctime);

                            case 6:
                                _context5.prev = 6;
                                _context5.t0 = _context5["catch"](0);
                                return _context5.abrupt("return", 0);

                            case 9:
                            case "end":
                                return _context5.stop();
                        }
                    }
                }, _callee5, this, [[0, 6]]);
            }));

            return function ctime() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "atime",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
                return regeneratorRuntime.wrap(function _callee6$(_context6) {
                    while (1) {
                        switch (_context6.prev = _context6.next) {
                            case 0:
                                _context6.prev = 0;
                                _context6.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context6.abrupt("return", _context6.sent.atime);

                            case 6:
                                _context6.prev = 6;
                                _context6.t0 = _context6["catch"](0);
                                return _context6.abrupt("return", 0);

                            case 9:
                            case "end":
                                return _context6.stop();
                        }
                    }
                }, _callee6, this, [[0, 6]]);
            }));

            return function atime() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "crtime",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
                return regeneratorRuntime.wrap(function _callee7$(_context7) {
                    while (1) {
                        switch (_context7.prev = _context7.next) {
                            case 0:
                                _context7.prev = 0;
                                _context7.next = 3;
                                return fs.lstat(this.path);

                            case 3:
                                return _context7.abrupt("return", _context7.sent.birthtime);

                            case 6:
                                _context7.prev = 6;
                                _context7.t0 = _context7["catch"](0);
                                return _context7.abrupt("return", 0);

                            case 9:
                            case "end":
                                return _context7.stop();
                        }
                    }
                }, _callee7, this, [[0, 6]]);
            }));

            return function crtime() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "chmod",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee8(mode) {
                return regeneratorRuntime.wrap(function _callee8$(_context8) {
                    while (1) {
                        switch (_context8.prev = _context8.next) {
                            case 0:
                                _context8.next = 2;
                                return fs.chmod(this.path, mode);

                            case 2:
                                return _context8.abrupt("return", _context8.sent);

                            case 3:
                            case "end":
                                return _context8.stop();
                        }
                    }
                }, _callee8, this);
            }));

            return function chmod(_x) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "chmodr",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee9(mode) {
                return regeneratorRuntime.wrap(function _callee9$(_context9) {
                    while (1) {
                        switch (_context9.prev = _context9.next) {
                            case 0:
                                _context9.next = 2;
                                return _chmodr(this.path, mode);

                            case 2:
                                return _context9.abrupt("return", _context9.sent);

                            case 3:
                            case "end":
                                return _context9.stop();
                        }
                    }
                }, _callee9, this);
            }));

            return function chmodr(_x2) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "chown",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee10(user, group) {
                return regeneratorRuntime.wrap(function _callee10$(_context10) {
                    while (1) {
                        switch (_context10.prev = _context10.next) {
                            case 0:
                                if (!(Number.isInteger(user) && Number.isInteger(group))) {
                                    _context10.next = 4;
                                    break;
                                }

                                _context10.next = 3;
                                return fs.chown(this.path, user, group);

                            case 3:
                                return _context10.abrupt("return", _context10.sent);

                            case 4:
                                _context10.next = 6;
                                return system.execOut("chown " + user + ":" + group + " " + this.path);

                            case 6:
                                return _context10.abrupt("return", _context10.sent);

                            case 7:
                            case "end":
                                return _context10.stop();
                        }
                    }
                }, _callee10, this);
            }));

            return function chown(_x3, _x4) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "chownr",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee11(user, group) {
                return regeneratorRuntime.wrap(function _callee11$(_context11) {
                    while (1) {
                        switch (_context11.prev = _context11.next) {
                            case 0:
                                if (!(Number.isInteger(user) && Number.isInteger(group))) {
                                    _context11.next = 4;
                                    break;
                                }

                                _context11.next = 3;
                                return _chownr(this.path, user, group);

                            case 3:
                                return _context11.abrupt("return", _context11.sent);

                            case 4:
                                _context11.next = 6;
                                return system.execOut("chown -R " + user + ":" + group + " " + this.path);

                            case 6:
                                return _context11.abrupt("return", _context11.sent);

                            case 7:
                            case "end":
                                return _context11.stop();
                        }
                    }
                }, _callee11, this);
            }));

            return function chownr(_x5, _x6) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "rename",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee12(new_name) {
                return regeneratorRuntime.wrap(function _callee12$(_context12) {
                    while (1) {
                        switch (_context12.prev = _context12.next) {
                            case 0:
                                _context12.next = 2;
                                return fs.rename(this.path, new_name);

                            case 2:
                                return _context12.abrupt("return", _context12.sent);

                            case 3:
                            case "end":
                                return _context12.stop();
                        }
                    }
                }, _callee12, this);
            }));

            return function rename(_x7) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "unlink",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee13() {
                return regeneratorRuntime.wrap(function _callee13$(_context13) {
                    while (1) {
                        switch (_context13.prev = _context13.next) {
                            case 0:
                                _context13.next = 2;
                                return fs.unlink(this.path);

                            case 2:
                                return _context13.abrupt("return", _context13.sent);

                            case 3:
                            case "end":
                                return _context13.stop();
                        }
                    }
                }, _callee13, this);
            }));

            return function unlink() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "rm",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee14() {
                return regeneratorRuntime.wrap(function _callee14$(_context14) {
                    while (1) {
                        switch (_context14.prev = _context14.next) {
                            case 0:
                                _context14.next = 2;
                                return this.unlink();

                            case 2:
                                return _context14.abrupt("return", _context14.sent);

                            case 3:
                            case "end":
                                return _context14.stop();
                        }
                    }
                }, _callee14, this);
            }));

            return function rm() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "rmdir",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee15() {
                return regeneratorRuntime.wrap(function _callee15$(_context15) {
                    while (1) {
                        switch (_context15.prev = _context15.next) {
                            case 0:
                                _context15.next = 2;
                                return fs.rmdir(this.path);

                            case 2:
                                return _context15.abrupt("return", _context15.sent);

                            case 3:
                            case "end":
                                return _context15.stop();
                        }
                    }
                }, _callee15, this);
            }));

            return function rmdir() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "rmrf",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee16() {
                return regeneratorRuntime.wrap(function _callee16$(_context16) {
                    while (1) {
                        switch (_context16.prev = _context16.next) {
                            case 0:
                                _context16.next = 2;
                                return _rimraf(this.path);

                            case 2:
                                return _context16.abrupt("return", _context16.sent);

                            case 3:
                            case "end":
                                return _context16.stop();
                        }
                    }
                }, _callee16, this);
            }));

            return function rmrf() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "mkdir",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee17(mode) {
                return regeneratorRuntime.wrap(function _callee17$(_context17) {
                    while (1) {
                        switch (_context17.prev = _context17.next) {
                            case 0:
                                mode = mode || 493;
                                _context17.next = 3;
                                return fs.mkdir(this.path, mode);

                            case 3:
                                return _context17.abrupt("return", _context17.sent);

                            case 4:
                            case "end":
                                return _context17.stop();
                        }
                    }
                }, _callee17, this);
            }));

            return function mkdir(_x8) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "mkdirp",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee18(mode) {
                return regeneratorRuntime.wrap(function _callee18$(_context18) {
                    while (1) {
                        switch (_context18.prev = _context18.next) {
                            case 0:
                                _context18.next = 2;
                                return _mkdirp(this.path, mode);

                            case 2:
                                return _context18.abrupt("return", _context18.sent);

                            case 3:
                            case "end":
                                return _context18.stop();
                        }
                    }
                }, _callee18, this);
            }));

            return function mkdirp(_x9) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "glob",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee19() {
                return regeneratorRuntime.wrap(function _callee19$(_context19) {
                    while (1) {
                        switch (_context19.prev = _context19.next) {
                            case 0:
                                _context19.next = 2;
                                return _glob(this.path);

                            case 2:
                                return _context19.abrupt("return", _context19.sent);

                            case 3:
                            case "end":
                                return _context19.stop();
                        }
                    }
                }, _callee19, this);
            }));

            return function glob() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "read",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee20() {
                return regeneratorRuntime.wrap(function _callee20$(_context20) {
                    while (1) {
                        switch (_context20.prev = _context20.next) {
                            case 0:
                                _context20.next = 2;
                                return fs.readFile(this.path, 'utf8');

                            case 2:
                                return _context20.abrupt("return", _context20.sent);

                            case 3:
                            case "end":
                                return _context20.stop();
                        }
                    }
                }, _callee20, this);
            }));

            return function read() {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "mkdirp_path",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee21(mode) {
                return regeneratorRuntime.wrap(function _callee21$(_context21) {
                    while (1) {
                        switch (_context21.prev = _context21.next) {
                            case 0:
                                mode = mode || 493;
                                _context21.next = 3;
                                return _mkdirp(path.dirname(this.path), mode);

                            case 3:
                                return _context21.abrupt("return", _context21.sent);

                            case 4:
                            case "end":
                                return _context21.stop();
                        }
                    }
                }, _callee21, this);
            }));

            return function mkdirp_path(_x10) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "write",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee22(contents, file_mode, dir_mode) {
                return regeneratorRuntime.wrap(function _callee22$(_context22) {
                    while (1) {
                        switch (_context22.prev = _context22.next) {
                            case 0:
                                dir_mode = dir_mode || 493;
                                file_mode = file_mode || 420;

                                _context22.next = 4;
                                return this.mkdirp_path(dir_mode);

                            case 4:
                                _context22.next = 6;
                                return fs.writeFile(this.path, contents, { encoding: 'utf8', mode: file_mode });

                            case 6:
                                return _context22.abrupt("return", _context22.sent);

                            case 7:
                            case "end":
                                return _context22.stop();
                        }
                    }
                }, _callee22, this);
            }));

            return function write(_x11, _x12, _x13) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "append",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee23(contents, file_mode, dir_mode) {
                return regeneratorRuntime.wrap(function _callee23$(_context23) {
                    while (1) {
                        switch (_context23.prev = _context23.next) {
                            case 0:
                                dir_mode = dir_mode || 493;
                                file_mode = file_mode || 420;

                                _context23.next = 4;
                                return this.mkdirp_path(dir_mode);

                            case 4:
                                _context23.next = 6;
                                return fs.appendFile(this.path, contents, { encoding: 'utf8', mode: file_mode });

                            case 6:
                                return _context23.abrupt("return", _context23.sent);

                            case 7:
                            case "end":
                                return _context23.stop();
                        }
                    }
                }, _callee23, this);
            }));

            return function append(_x14, _x15, _x16) {
                return ref.apply(this, arguments);
            };
        })()
    }, {
        key: "realpath",
        value: (function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee24() {
                return regeneratorRuntime.wrap(function _callee24$(_context24) {
                    while (1) {
                        switch (_context24.prev = _context24.next) {
                            case 0:
                                _context24.next = 2;
                                return fs.realpath(this.path);

                            case 2:
                                return _context24.abrupt("return", _context24.sent);

                            case 3:
                            case "end":
                                return _context24.stop();
                        }
                    }
                }, _callee24, this);
            }));

            return function realpath() {
                return ref.apply(this, arguments);
            };
        })()
    }]);

    return File;
})();

function file(path) {
    return new File(path);
}

module.exports = file;