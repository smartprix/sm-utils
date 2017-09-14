import {expect} from 'chai';
import {Crypt} from '../src/index';

describe('crypt library', () => {
	it('should correctly verify password', () => {
		const password = 'abc';
		const hashed = Crypt.hashPassword(password);
		const verified = Crypt.verifyPassword(password, hashed);
		const wrong = Crypt.verifyPassword(password + 'a', hashed);
		expect(hashed.length).to.equal(50);
		expect(verified).to.be.true;
		expect(wrong).to.be.false;
	});

	it('should correctly encrypt & decrypt', () => {
		const string = 'abc';
		const key = 'def';
		const encrypted = Crypt.encrypt(string, key);
		const decrypted = Crypt.decrypt(encrypted, key);
		const decryptedWrong = Crypt.decrypt(encrypted, key + 'a');
		expect(encrypted.length).to.be.above(20);
		expect(decrypted).to.equal(string);
		expect(decryptedWrong).to.not.equal(string);
	});

	it('should correctly pack & unpack numbers', () => {
		const numbers = [0, 1, 2, 3, 4.901, -6, 5, -2.512, -1, 0, 1, 5];
		const packed = Crypt.packNumbers(numbers);
		const unpacked = Crypt.unpackNumbers(packed);
		expect(packed).to.match(/^[a-zA-Z0-9]+$/);
		expect(unpacked).to.deep.equal(numbers);
	});
});

