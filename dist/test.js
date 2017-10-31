'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _Connect = require('./Connect');

var _Connect2 = _interopRequireDefault(_Connect);

var _crypt = require('./crypt');

var _crypt2 = _interopRequireDefault(_crypt);

var _d_real = require('./debug/d_real');

var _d_real2 = _interopRequireDefault(_d_real);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable */
console.log(_crypt2.default.sequentialId(15));
console.log(_crypt2.default.sequentialId({ length: 18, lowercase: true }));
console.log(_crypt2.default.sequentialUUID());

console.log(_crypt2.default.randomId(15));
console.log(_crypt2.default.randomId({ length: 15, charset: _crypt2.default.chars.NUMERIC }));
console.log(_crypt2.default.randomId({ length: 15, charset: _crypt2.default.chars.HEX }));
console.log(_crypt2.default.randomId({ length: 15, charset: _crypt2.default.chars.BASE_36 }));
console.log(_crypt2.default.randomId({ length: 15, charset: _crypt2.default.chars.BASE_64 }));
console.log(_crypt2.default.randomId({ length: 15, charset: _crypt2.default.chars.PRINTABLE }));
console.log(_crypt2.default.uuid());

console.log(_crypt2.default.md5('Hello', 'base64'));
console.log(_crypt2.default.sha1('Hello'));
console.log(_crypt2.default.sha256('Hello'));
console.log(_crypt2.default.sha512('Hello'));

console.log(_crypt2.default.base64Encode('Hello'));
console.log(_crypt2.default.base64UrlEncode('Hello'));
console.log(_crypt2.default.base64Decode(_crypt2.default.base64Encode('Hello')));
console.log(_crypt2.default.base64UrlDecode(_crypt2.default.base64UrlEncode('Hello')));

let crypted = _crypt2.default.encrypt('This is really really cool', 'Hello');
console.log(crypted);
console.log(_crypt2.default.decrypt(crypted, 'Hello'));

crypted = _crypt2.default.encryptStatic('asdf', 'This is really really cool');
console.log(crypted);
console.log(_crypt2.default.decryptStatic(crypted, 'This is really really cool'));

const hashed = _crypt2.default.hashPassword('yoman');
console.log(hashed);
console.log(_crypt2.default.verifyPassword('yoman', hashed));

const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const shuffled1 = _crypt2.default.shuffle(array, { seed: 10 });
const shuffled2 = _crypt2.default.shuffle(array, { seed: 20 });
const shuffled3 = _crypt2.default.shuffle(array, { seed: 10 });
const shuffled4 = _crypt2.default.shuffle(array);
console.log(shuffled1, shuffled2, shuffled3, shuffled4, _lodash2.default.isEqual(shuffled1, shuffled2), _lodash2.default.isEqual(shuffled1, shuffled3), _lodash2.default.isEqual(shuffled1, shuffled4), _lodash2.default.isEqual(shuffled2, shuffled4));

(0, _d_real2.default)(new Error('hello'));

async function main() {
	(0, _d_real2.default)(_lodash2.default.pick((await _Connect2.default.url('http://www.smartprix.com/ip.php').cacheDir('garbage/cache').save('yo.txt')), ['body', 'statusCode', 'url', 'timeTaken', 'cached']));

	const obj = { a: 'b' };
	(0, _d_real2.default)(obj);
}

main().then(() => process.exit());