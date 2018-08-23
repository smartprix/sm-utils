/** @module Str */

/**
 * Convert a number into words
 *
 * @param {number} number
 * @returns {string}
 */
function numberToWords(number) {
	const dictionary = {
		0: 'zero',
		1: 'one',
		2: 'two',
		3: 'three',
		4: 'four',
		5: 'five',
		6: 'six',
		7: 'seven',
		8: 'eight',
		9: 'nine',
		10: 'ten',
		11: 'eleven',
		12: 'twelve',
		13: 'thirteen',
		14: 'fourteen',
		15: 'fifteen',
		16: 'sixteen',
		17: 'seventeen',
		18: 'eighteen',
		19: 'nineteen',
		20: 'twenty',
		30: 'thirty',
		40: 'fourty',
		50: 'fifty',
		60: 'sixty',
		70: 'seventy',
		80: 'eighty',
		90: 'ninety',
		100: 'hundred',
		1000: 'thousand',
		1000000: 'million',
		1000000000: 'billion',
		1000000000000: 'trillion',
		1000000000000000: 'quadrillion',
		1000000000000000000: 'quintillion',
	};
	if (typeof number !== 'number') {
		return false;
	}
	if ((number >= 0 && number < 0) || number < 0 - Number.MAX_SAFE_INTEGER) {
		// overflow
		throw new Error('convert_number_to_words only accepts numbers between -' + Number.MAX_SAFE_INTEGER + ' and ' + Number.MAX_SAFE_INTEGER);
	}
	if (number < 0) {
		return 'negative ' + numberToWords(Math.abs(number));
	}
	let string = null;
	let fraction = null;
	if (number.toString().indexOf('.') !== -1) {
		const temp = number.toString().split('.');
		number = parseInt(temp[0], 10);
		fraction = parseInt(temp[1], 10);
	}
	switch (true) {
		case number < 21:
			string = dictionary[number];
			break;
		case number < 100: {
			const tens = (parseInt(number / 10, 10)) * 10;
			const units = number % 10;
			string = dictionary[tens];
			if (units) {
				string += '-' + dictionary[units];
			}
			break;
		}
		case number < 1000: {
			const hundreds = parseInt(number / 100, 10);
			const remainder = number % 100;
			string = dictionary[hundreds] + ' ' + dictionary[100];
			if (remainder) {
				string += ' and ' + numberToWords(remainder);
			}
			break;
		}
		default: {
			const baseUnit = 1000 ** Math.floor(Math.log(number) / Math.log(1000));
			const numBaseUnits = parseInt(number / baseUnit, 10);
			const remainder = number % baseUnit;
			string = numberToWords(numBaseUnits) + ' ' + dictionary[baseUnit];
			if (remainder) {
				string += remainder < 100 ? ' and ' : ', ';
				string += numberToWords(remainder);
			}
			break;
		}
	}
	if (fraction && typeof fraction === 'number') {
		string += ' point ';
		const words = [];
		fraction.toString().split('').forEach((num) => {
			words.push(dictionary[num]);
		});
		string += words.join(' ');
	}
	return string;
}

export default numberToWords;
