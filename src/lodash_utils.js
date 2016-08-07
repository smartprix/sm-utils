const _ = require('lodash');

_.invertCase = function (str) {
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
};

_.parseJSON = function (str) {
	try {
		return JSON.parse(str);
	}
	catch (e) {
		return null;
	}
};

JSON.parseSafe = _.parseJSON;
