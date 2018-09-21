import {expect} from 'chai';
import {Str} from '../src/index';

describe('@str library', () => {
	it('should correctly invertCase', () => {
		expect(Str.invertCase('SMartprix SmartPhones')).to.equal('smARTPRIX sMARTpHONES');
	});

	it('should correctly plural words', () => {
		expect(Str.plural('smartphone')).to.equal('smartphones');
	});

	it('should correctly transform string', () => {
		expect(Str.transform('abc', 'bc', 'de')).to.equal('ade');
	});

	it('should correctly trimToNext', () => {
		expect(Str.trimToNext('Where left hand json field reference is a superset of the right hand json value or reference', 40, ' ')).to.equal('Where left hand json field reference is a');
	});

	it('should correctly number format', () => {
		expect(Str.numberFormat(12)).to.equal('12');
		expect(Str.numberFormat(1000)).to.equal('1,000');
		expect(Str.numberFormat(1234452.534)).to.equal('1,234,453');
		expect(Str.numberFormat(123456.3443, {decimals: 2})).to.equal('123,456.34');
		expect(Str.numberFormat(123456.3443, {decimals: 2, currency: 'USD'})).to.equal('$123,456.34');
	});

	it('should correctly convert number to words', () => {
		expect(Str.numberToWords(12)).to.equal('twelve');
		expect(Str.numberToWords(5555555)).to.equal('five million, five hundred and fifty-five thousand, five hundred and fifty-five');
		expect(Str.numberToWords(100000000)).to.equal('one hundred million');
	});

	it('should correctly tryParseJson', () => {
		expect(Str.tryParseJson(undefined)).to.equal(null);
		expect(Str.tryParseJson(null)).to.equal(null);
		expect(Str.tryParseJson([1, 2, 3, 'a'])).to.deep.equal([1, 2, 3, 'a']);
		expect(Str.tryParseJson({a: 1, b: 2})).to.deep.equal({a: 1, b: 2});
		expect(Str.tryParseJson(1)).to.equal(1);
		expect(Str.tryParseJson('{"a": 1, "b": 2}')).to.deep.equal({a: 1, b: 2});
		expect(Str.tryParseJson('{a: "1", b: "2"}')).to.equal(null);
	});

	it('should correctly tryStringifyJson', () => {
		expect(Str.tryStringifyJson(undefined)).to.equal('null');
		expect(Str.tryStringifyJson(null)).to.equal('null');
		expect(Str.tryStringifyJson('{"a": "1", "b": "2"}')).to.equal('{"a": "1", "b": "2"}');
		expect(Str.tryStringifyJson([1, 2, 3, 'a'])).to.equal('[1,2,3,"a"]');
		expect(Str.tryStringifyJson({a: 1, b: 2})).to.equal('{"a":1,"b":2}');
	});

	it('should correctly strip tags', () => {
		expect(Str.stripTags('Kevin <b>van</b> <u></u> <i>Zonneveld</i>')).to.equal('Kevin van  Zonneveld');
		expect(Str.stripTags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>'))
			.to.equal('Kevin van Zonneveld');
		expect(Str.stripTags('<a href=\'http://abc.io\' target="_blank">Kevin van Zonneveld</a>'))
			.to.equal('Kevin van Zonneveld');
		expect(Str.stripTags('<a href=\'http://abc.io\' target="_blank">Kevin van Zonneveld</a>', {allowed: ['a']}))
			.to.equal('<a href=\'http://abc.io\' target="_blank">Kevin van Zonneveld</a>');
		expect(Str.stripTags('<p>Kevin <b>van</b> <u></u> <i>Zonneveld</i></p>', {allowed: ['b', 'u']}))
			.to.equal('Kevin <b>van</b> <u></u> Zonneveld');
		expect(Str.stripTags('<i>hello</i> <<foo>script>world<</foo>/script>'))
			.to.equal('hello world');
		expect(
			Str.stripTags('Kevin <b>van</b> <u></u> <i>Zonneveld</i>', {
				replaceWith: '$',
				allowed: ['b', 'u'],
				blocked: ['b'],
			})
		).to.equal('Kevin $van$ <u></u> $Zonneveld$');
		expect(
			Str.stripTags('Kevin <b>van</b> <u></u> <i>Zonneveld</i>', {
				blocked: ['b'],
			})
		).to.equal('Kevin van <u></u> <i>Zonneveld</i>');
	});
});
