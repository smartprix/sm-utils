import _ from 'lodash';

function invertCase(str) {
	let output = '';
	let code = '';

	for (let i = 0, len = str.length - 1; i <= len; i++) {
		code = str.charCodeAt(i);
		if (code >= 65 && code <= 90) {
			output += str.charAt(i).toLowerCase();
		}
		else if (code >= 97 && code <= 122) {
			output += str.charAt(i).toUpperCase();
		}
		else {
			output += str.charAt(i);
		}
	}

	return output;
}

function isVowel(char) {
	return (/^[aeiou]$/i).test(char);
}

function isConsonant(char) {
	return !isVowel(char);
}

// Get the plural of a string
function plural(str) {
	if (!str || str.length <= 2) return str;

	if (str.charAt(str.length - 1) === 'y') {
		if (isVowel(str.charAt(str.length - 2))) {
			// If the y has a vowel before it (i.e. toys), then you just add the s.
			return str + 's';
		}

		// If a this ends in y with a consonant before it (fly)
		// you drop the y and add -ies to make it plural.
		return str.slice(0, -1) + 'ies';
	}
	else if (str.substring(str.length - 2) === 'us') {
		// ends in us -> i, needs to preceed the generic 's' rule
		return str.slice(0, -2) + 'i';
	}
	else if (
		['ch', 'sh'].indexOf(str.substring(str.length - 2)) !== -1 ||
		['x', 's'].indexOf(str.charAt(str.length - 1)) !== -1
	) {
		// If a this ends in ch, sh, x, s, you add -es to make it plural.
		return str + 'es';
	}

	// anything else, just add s
	return str + 's';
}

// Pluralize a character if the count is greater than 1
function pluralize(str, count = 2) {
	if (count <= 1) return str;
	return plural(str);
}

/**
 * transform a string by replacing characters from from string to to string
 * eg. `Str.transform('abc', 'bc', 'de') // returns ade`
 * @param {string} str string to transform
 * @param {string} from characters to replace in the string
 * @param {string} to characters to replace with in the string
 * @returns {string} transformed string
 */
function transform(str, from, to) {
	const len = str.length;
	let out = '';
	let pos;

	for (let i = 0; i < len; i++) {
		pos = from.indexOf(str.charAt(i));
		if (pos >= 0) {
			out += to.charAt(pos);
		}
		else {
			out += str.charAt(i);
		}
	}

	return out;
}

// Break String From Next Given Character After A Given Position
function trimToNext(str, pos, char = ' ') {
	const trimPos = str.indexOf(char, pos);
	if (trimPos !== -1) {
		return _.trimEnd(str.substring(0, trimPos), char);
	}

	return _.trimEnd(str, char);
}

export default {
	invertCase,
	isVowel,
	isConsonant,
	plural,
	pluralize,
	transform,
	trimToNext,
};
