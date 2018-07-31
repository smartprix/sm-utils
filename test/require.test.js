/* global it, describe */
/* eslint-disable no-unused-expressions */

import {expect} from 'chai';
import {Require} from '../src/index';

describe('@require library', () => {
	it('should correctly resolve global path', async () => {
		const path = Require.resolve('pm2');
		const globalPath = Require.resolveGlobal('pm2');

		expect(path).to.match(/node_modules\/pm2\/index\.js$/);
		expect(globalPath).to.equal(path);
	});

	it('should correctly resolve npm', async () => {
		const path = Require.resolve('npm');
		const globalPath = Require.resolveGlobal('npm');

		expect(path).to.match(/node_modules\/npm\/[a-z/]+\.js$/);
		expect(globalPath).to.equal(path);
	});

	it('should correctly require global modules', async () => {
		const pm2 = Require.require('pm2');
		const globalPm2 = Require.global('pm2');

		expect(pm2).to.have.property('connect');
		expect(globalPm2 === pm2).to.be.true;
	});

	it('should correctly resolve local path', async () => {
		const path = Require.resolve('lodash');
		expect(path).to.contain(process.cwd());
	});
});
