// eslint-disable-next-line
const NUMERALS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_!#$%&()*+,./:;<=>?@[]^`{|}~';

/**
 * convert arbitary long integer from one base to another
 * Taken from decimal.js
*/
function baseConvert(str, baseIn = 10, baseOut = 62) {
	str = String(str);
	if (baseIn > 10 && baseIn <= 36) {
		str = str.toLowerCase();
	}

	let j;
	const arr = [0];
	let arrL;
	let i = 0;
	const strL = str.length;

	while (i < strL) {
		for (arrL = arr.length; arrL--; arr[arrL] *= baseIn);
		arr[j = 0] += NUMERALS.indexOf(str.charAt(i++));

		for (; j < arr.length; j++) {
			if (arr[j] > baseOut - 1) {
				if (arr[j + 1] == null) {
					arr[j + 1] = 0;
				}
				arr[j + 1] += arr[j] / baseOut | 0;
				arr[j] %= baseOut;
			}
		}
	}

	return arr.reverse().map(k => NUMERALS[k]).join('');
}

module.exports = baseConvert;
