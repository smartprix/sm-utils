import {expect} from 'chai';
import {Str} from '../src/index';

describe('str library', () => {
	it('should correctly invertCase', () => {
		expect(Str.invertCase('SMartprix SmartPhones')).to.equal('smARTPRIX sMARTpHONES');
	});

	it('should correctly plural words', () => {
		expect(Str.plural('smartphone')).to.equal('smartphones');
	});

	it('should correctly transform string', () => {
		expect(Str.transform('abc', 'bc', 'de')).to.equal('ade');
	});
});
