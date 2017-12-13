import fs from 'fs';
import {expect} from 'chai';
import {Crypt} from '../src/index';

const privateKeyString = fs.readFileSync(`${__dirname}/private.pem`);
const privateKey = {key: privateKeyString, passphrase: 'smutils'};
const publicKey = fs.readFileSync(`${__dirname}/public.pem`);

describe('crypt library', () => {
	it('should correctly convert integers from one base to another', () => {
		const decimalNumbers = [1, 12, 123, 1234, 12345, 123456,
			1234567, 12345678, 123456789, 1234567890];
		const binaryNumbers = ['1', '1100', '1111011', '10011010010', '11000000111001', '11110001001000000',
			'100101101011010000111', '101111000110000101001110', '111010110111100110100010101', '1001001100101100000001011010010'];
		const hexNumbers = ['1', 'c', '7b', '4d2', '3039', '1e240',
			'12d687', 'bc614e', '75bcd15', '499602d2'];
		const base36Numbers = ['1', 'c', '3f', 'ya', '9ix', '2n9c',
			'qglj', '7clzi', '21i3v9', 'kf12oi'];
		const base62Numbers = ['1', 'C', '1z', 'Ju', '3D7', 'W7E',
			'5BAN', 'pnfq', '8M0kX', '1LY7VK'];

		for (let i = 0; i < decimalNumbers.length; i++) {
			const decNum = decimalNumbers[i];
			const binNum = Crypt.baseConvert(decNum, 10, 2);
			const hexNum = Crypt.baseConvert(decNum, 10, 16);
			const base36Num = Crypt.baseConvert(decNum, 10, 36);
			const base62Num = Crypt.baseConvert(decNum, 10, 62);

			expect(binNum).to.equal(binaryNumbers[i]);
			expect(hexNum).to.equal(hexNumbers[i]);
			expect(base36Num).to.equal(base36Numbers[i]);
			expect(base62Num).to.equal(base62Numbers[i]);
		}
	});

	it('should correctly generate random strings', () => {
		const randomString = Crypt.randomString();

		let randomStrings = [];
		for (let i = 0; i < 1e4; i++) randomStrings.push(Crypt.randomString({length: 5}));
		randomStrings = new Set(randomStrings);

		expect(randomString.length).to.equal(20);
		expect(randomString).to.match(/^[a-zA-Z0-9]{20}$/);
		expect(randomStrings.size).to.be.closeTo(1e4, 10);
	});

	it('should correctly shuffle items', () => {
		const str = Crypt.randomString().split();
		const shuffledStr = Crypt.shuffle(str);

		const diff = str.filter(x => !shuffledStr.includes(x));

		expect(str.length).to.equal(shuffledStr.length);
		expect(diff.length).to.equal(0);
	});

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

	it('should correctly sign and verify messages', () => {
		const message = 'hello there';
		const sign = Crypt.sign(message, privateKey, {encoding: 'base64url'});
		const verified = Crypt.verify(message, sign, publicKey, {encoding: 'base64url'});
		const wrong = Crypt.verify(message + 'a', sign, publicKey, {encoding: 'base64url'});
		// console.log(sign, sign.length);
		expect(sign.length).to.be.within(90, 100);
		expect(verified).to.be.true;
		expect(wrong).to.be.false;
	});

	it('should correctly signAndEncrypt messages', () => {
		const message = {a: 'bcd', b: true};
		const token = Crypt.signAndEncrypt(message, privateKey, publicKey);
		// console.log(token, token.length);
		const messageDecoded = Crypt.verifyAndDecrypt(token, publicKey);
		expect(token).to.match(/^[a-zA-Z0-9_.-]+$/);
		expect(messageDecoded).to.deep.equal(message);
	});

	it('should correctly rot47 a string', () => {
		const str = 'Encoding is not encryption.';
		const rotated = 't?4@5:?8 :D ?@E 6?4CJAE:@?]';
		expect(Crypt.rot47(str)).to.equal(rotated);
		expect(Crypt.rot47(rotated)).to.equal(str);
	});

	it('should correctly javaObfuscate & javaUnobfuscate', async () => {
		const original = '{"href":"http://new.smartprix.com:8080/","ancestorOrigins":{},"origin":"http://new.smartprix.com:8080","protocol":"http:","host":"new.smartprix.com:8080","hostname":"new.smartprix.com","port":"8080","pathname":"/","search":"","hash":""}';
		const obfuscated = 'hY7RCsMwCEX/SUI2A0sMKmxQCj6Xpo8lP7FvXyzt28bevHrPwcmQ4826oWrtrZX4XCUDa+X0WgPlvm/71mwxKCGKEr853VMR69O8GB3hHz7oyqQU6HFVxwpJdMSfiN8L5Pit40Zixy8/KJ5lf1YicMAR3ANyTPMH';

		expect(await Crypt.javaObfuscate(original)).to.equal(obfuscated);
		expect(await Crypt.javaUnobfuscate(obfuscated)).to.equal(original);
	});
});
