/* global it, describe */
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
});
