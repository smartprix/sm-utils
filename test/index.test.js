const expect = require('chai').expect;
const utils = require('../dist/index');

describe('my library', () => {
	it('should work', () => {
		expect(typeof utils).to.be.equal('object');
	});
});

