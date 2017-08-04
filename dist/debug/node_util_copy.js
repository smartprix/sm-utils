const nodeUtil = require('util');

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
nodeUtil.inspect.colors = {
	bold: [1, 22],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	white: [37, 39],
	grey: [90, 39],
	black: [30, 39],
	blue: [34, 39],
	cyan: [36, 39],
	green: [32, 39],
	magenta: [35, 39],
	red: [31, 39],
	yellow: [33, 39],
	yellow_bold: ['33;1', '22;39'],
	blue_bold: ['34;1', '22;39'],
	white_bold: ['37;1', '22;39'],
	grey_bold: ['90;1', '22;39'],
	black_bold: ['30;1', '22;39'],
	cyan_bold: ['36;1', '22;39'],
	green_bold: ['32;1', '22;39'],
	magenta_bold: ['35;1', '22;39'],
	red_bold: ['31;1', '22;39']
};

// Don't use 'blue' not visible on cmd.exe
nodeUtil.inspect.styles = {
	special: 'cyan',
	number: 'yellow_bold',
	boolean: 'yellow_bold',
	undefined: 'grey_bold',
	null: 'grey_bold',
	string: 'green',
	symbol: 'green',
	date: 'magenta',
	name: 'blue_bold',
	regexp: 'red'
};

module.exports = nodeUtil;