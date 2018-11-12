/* eslint-disable no-unused-expressions */

import {expect} from 'chai';
import {cfg} from '../src/index';

describe('cfg', () => {
	it('should get and set values', async () => {
		cfg.set('a.b', 'c');
		expect(cfg('a')).to.deep.equal({b: 'c'});
		expect(cfg('a.b')).to.equal('c');
		expect(cfg('a.b.c', 'd')).to.equal('d');
	});

	it('should merge values', () => {
		cfg.file(`${__dirname}/config.json`);
		expect(cfg('a.b')).to.equal('c');
		expect(cfg('test')).to.equal('data');
	});

	it('should overwrite values', () => {
		cfg.file(`${__dirname}/config.json`, {overwrite: true});
		expect(cfg('a.b')).to.equal(undefined);
		expect(cfg('test')).to.equal('data');
	});

	it('should return correct env', () => {
		expect(cfg.env()).to.equal('test');
		expect(cfg.isTest()).to.equal(true);
		expect(cfg.isDev()).to.equal(true);
	});

	it('should allow to change env', () => {
		process.env.NODE_ENV = 'production';
		expect(cfg.isDev()).to.equal(false);
		expect(cfg.isProd()).to.equal(true);
		expect(cfg.isProdLike()).to.equal(true);
		process.env.NODE_ENV = 'test';
		expect(cfg.isProd()).to.equal(false);
	});
});
