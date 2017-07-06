/* eslint-disable */
import _ from 'lodash';
import Connect from './Connect';

const crypt = require('./crypt');
const d = require('./debug/d_real');

console.log(crypt.sequentialId(15));
console.log(crypt.sequentialId({length: 18, lowercase: true}));
console.log(crypt.sequentialUUID());

console.log(crypt.randomId(15));
console.log(crypt.randomId({length: 15, charset: crypt.chars.NUMERIC}));
console.log(crypt.randomId({length: 15, charset: crypt.chars.HEX}));
console.log(crypt.randomId({length: 15, charset: crypt.chars.BASE_36}));
console.log(crypt.randomId({length: 15, charset: crypt.chars.BASE_64}));
console.log(crypt.randomId({length: 15, charset: crypt.chars.PRINTABLE}));
console.log(crypt.uuid());

console.log(crypt.md5('Hello', 'base64'));
console.log(crypt.sha1('Hello'));
console.log(crypt.sha256('Hello'));
console.log(crypt.sha512('Hello'));

console.log(crypt.base64Encode('Hello'));
console.log(crypt.base64UrlEncode('Hello'));
console.log(crypt.base64Decode(crypt.base64Encode('Hello')));
console.log(crypt.base64UrlDecode(crypt.base64UrlEncode('Hello')));

let crypted = crypt.encrypt('This is really really cool', 'Hello');
console.log(crypted);
console.log(crypt.decrypt(crypted, 'Hello'));

crypted = crypt.encryptStatic('asdf', 'This is really really cool');
console.log(crypted);
console.log(crypt.decryptStatic(crypted, 'This is really really cool'));

const hashed = crypt.hashPassword('yoman');
console.log(hashed);
console.log(crypt.verifyPassword('yoman', hashed));

const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const shuffled1 = crypt.shuffle(array, {seed: 10});
const shuffled2 = crypt.shuffle(array, {seed: 20});
const shuffled3 = crypt.shuffle(array, {seed: 10});
const shuffled4 = crypt.shuffle(array);
console.log(shuffled1, shuffled2, shuffled3, shuffled4,
	_.isEqual(shuffled1, shuffled2),
	_.isEqual(shuffled1, shuffled3),
	_.isEqual(shuffled1, shuffled4),
	_.isEqual(shuffled2, shuffled4)
);

d(new Error('hello'));

async function main() {
	d(_.pick(await Connect.url('http://www.smartprix.com/ip.php').cacheDir('garbage/cache').save('yo.txt'), ['body', 'statusCode', 'url', 'timeTaken', 'cached']));
}

main().then(() => process.exit());
