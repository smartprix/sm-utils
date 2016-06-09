'use strict';

var crypt = require('./crypt');

var i = 0;
console.log(crypt.sequentialId(15));
console.log(crypt.sequentialId({ length: 18, lowercase: true }));
console.log(crypt.sequentialUUID());

console.log(crypt.randomId(15));
console.log(crypt.randomId({ length: 15, charset: crypt.chars.NUMERIC }));
console.log(crypt.randomId({ length: 15, charset: crypt.chars.HEX }));
console.log(crypt.randomId({ length: 15, charset: crypt.chars.BASE_36 }));
console.log(crypt.randomId({ length: 15, charset: crypt.chars.BASE_64 }));
console.log(crypt.randomId({ length: 15, charset: crypt.chars.PRINTABLE }));
console.log(crypt.UUID());

console.log(crypt.md5("Hello", 'base64'));
console.log(crypt.sha1("Hello"));
console.log(crypt.sha256("Hello"));
console.log(crypt.sha512("Hello"));

console.log(crypt.base64Encode("Hello"));
console.log(crypt.base64UrlEncode("Hello"));
console.log(crypt.base64Decode(crypt.base64Encode("Hello")));
console.log(crypt.base64UrlDecode(crypt.base64UrlEncode("Hello")));

var crypted = crypt.encrypt("This is really really cool", "Hello");
console.log(crypted);
console.log(crypt.decrypt(crypted, "Hello"));

var crypted = crypt.encryptStatic("asdf", "This is really really cool");
console.log(crypted);
console.log(crypt.decryptStatic(crypted, "This is really really cool"));

var hashed = crypt.hashPassword('yoman');
console.log(hashed);
console.log(crypt.verifyPassword('yoman', hashed));