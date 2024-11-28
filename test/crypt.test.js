/* eslint-disable no-unused-expressions */
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

	it('should encode and decode strings correctly', () => {
		const asciiString = 'abcdefghij';
		const hexString = '6162636465666768696a';

		const asciiToHex = Crypt.baseEncode(asciiString, {fromEncoding: 'ascii', toEncoding: 'hex'});
		let decodedHex = Crypt.baseDecode(asciiToHex, 'hex');

		expect(asciiToHex).to.equal(hexString);
		expect(decodedHex).to.equal(asciiString);

		const base64EncodedString = Crypt.base64Encode(asciiString, 'ascii');
		const base64UrlEncodedString = Crypt.base64UrlEncode(hexString, 'hex');
		decodedHex = Crypt.base64UrlDecode(base64UrlEncodedString, 'hex');

		expect(base64EncodedString.split('=')[0].replace(/\+/g, '-').replace(/\//g, '_')).to.equal(base64UrlEncodedString);
		expect(decodedHex).to.equal(hexString);
	});

	// md5
	it('md5 hash', () => {
		const checksum = Crypt.md5('smartprix.com');
		expect(checksum).to.equal('ef4ec5aab5b3a74c658651114edaa2ca');
	});

	// sha1
	it('sha1 hash', () => {
		const checksum = Crypt.sha1('smartprix.com');
		expect(checksum).to.equal('b2258a8033b9e6be1973f2995c9ae61b2515e506');
	});

	// sha256
	it('sha256 hash', () => {
		const checksum = Crypt.sha256('smartprix.com');
		expect(checksum).to.equal('28da01e9ff9d1a260f240867b16569b1a7fd9740234cc56116b551721d2d10d1');
	});

	// sha384
	it('sha384 hash', () => {
		const checksum = Crypt.sha384('smartprix.com');
		expect(checksum).to.equal('9812b36a57576b3ca35c98779f2bf02b13c8e326fbc6a0578dc76aec277ed5e04e8f8b9f40e9cc541146e0c891a5ba7e');
	});

	// sha512
	it('sha512 hash', () => {
		const checksum = Crypt.sha512('smartprix.com');
		expect(checksum).to.equal('547b4a9fd5e6535a3caf0d9c63402b005f35c60a46f058126fee7828c37ff38d000896e5a78c08b2acd76b98a82826eb897ae5036a58a3ab65cbcabf807cc374');
	});

	// sha1Hmac
	it('sha1hmac', () => {
		const checksum = Crypt.sha1Hmac('smartprix.com', 'abcdefghijklm');
		expect(checksum).to.equal('b04def02e7c9786ff3585c8e656c092cd1568ab3');
	});

	// sha256Hmac
	it('sha256hmac', () => {
		const checksum = Crypt.sha256Hmac('smartprix.com', 'abcdefghijklm');
		expect(checksum).to.equal('cfd5d9d7c1a6c2494f69449f02ee7bf3f762c891b87ed2cbabc073218d31f0fa');
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
		const newObfuscated = 'hY5BCsMwDAT/JIxbB2rLSIIUQmDPJs4x6BN9e3Fobi29SWhm0IIk8QZHMqvee4nzppnEqkzPLXD2Yz/2jgYqIaqxvGS6T0Xhy9rA5/JPR0MVNg78uFA0JFaD46cy7oVy/MaMIsvQrz5Z+sDjWY0kIcExOqTntL4B';

		expect([obfuscated, newObfuscated]).to.include(await Crypt.javaObfuscate(original));
		expect(await Crypt.javaUnobfuscate(obfuscated)).to.equal(original);
		expect(await Crypt.javaUnobfuscate(newObfuscated)).to.equal(original);
	});

	it('should generate the same output for seededRandom', () => {
		const seededGenerator = Crypt.seededRandom(2341);
		expect(seededGenerator.string({length: 13})).to.equal('UK7NmbKCXfWw0');
		expect(seededGenerator.shuffle([1, 2, 3, 4])).to.deep.equal([2, 1, 4, 3]);
		expect(seededGenerator.int(0, 100)).to.equal(84);
		expect(seededGenerator.random()).to.equal(0.8101538523824274);
		expect(seededGenerator.bytes(2)).to.deep.equal(Buffer.from([234, 238]));
	});

	it('should generate the same output for seededRandom with string key', () => {
		const seededGenerator = Crypt.seededRandom('product_xyz');
		expect(seededGenerator.string({length: 13})).to.equal('Sk9mGcYZo7l92');
		expect(seededGenerator.shuffle([1, 2, 3, 4])).to.deep.equal([3, 2, 1, 4]);
		expect(seededGenerator.int(0, 100)).to.equal(55);
		expect(seededGenerator.random()).to.equal(0.5551895806752327);
		expect(seededGenerator.bytes(2)).to.deep.equal(Buffer.from([228, 97]));
	});
});
