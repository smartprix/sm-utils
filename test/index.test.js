var expect = require('chai').expect;
var utils = require('../dist/index');

describe('my library', () => {
    it('should work', () => {
        expect(true).to.be.true;
    });

    it('should correctly verify password', () => {
    	const password = 'abc';
    	const hashed = utils.crypt.hashPassword(password);
    	const verified = utils.crypt.verifyPassword(password, hashed);
    	const wrong = utils.crypt.verifyPassword(password + 'a', hashed);
    	expect(hashed.length).to.equal(50);
    	expect(verified).to.be.true;
    	expect(wrong).to.be.false;
    });

    it('should correctly encrypt & decrypt', () => {
    	const string = 'abc';
    	const key = 'def';
    	const encrypted = utils.crypt.encrypt(string, key);
    	const decrypted = utils.crypt.decrypt(encrypted, key);
    	const decryptedWrong = utils.crypt.decrypt(encrypted, key + 'a');
    	expect(encrypted.length).to.be.above(20);
    	expect(decrypted).to.equal(string);
    	expect(decryptedWrong).to.not.equal(string);
    });
});

