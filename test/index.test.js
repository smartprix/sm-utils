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
    	expect(verified).to.be.true;
    	expect(wrong).to.be.false;
    });
});

