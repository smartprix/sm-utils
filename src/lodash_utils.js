import _ from 'lodash';
import Str from './Str';

function parseJSON(str) {
	try {
		return JSON.parse(str);
	}
	catch (e) {
		return null;
	}
}

JSON.parseSafe = parseJSON;

const functions = {
	invertCase: Str.invertCase,
	parseJSON,
	isVowel: Str.isVowel,
	isConsonant: Str.isConsonant,
	plural: Str.pluralize,
};

function installTo(obj) {
	_.forEach(functions, (func, name) => {
		obj[name] = func;
	});
}

installTo(_);

functions.installTo = installTo;
module.exports = functions;
