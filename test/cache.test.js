/* global it, describe */
/* eslint-disable no-unused-expressions */

import {expect} from 'chai';
import {Cache} from '../src/index';

const cache = new Cache();
function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

describe('cache library', () => {
	it('should get and set values', async () => {
		const key = 'a';
		const value = 'this';
		expect(await cache.get(key)).to.be.undefined;
		expect(await cache.set(key, value)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
	});

	it('should correctly resolve promises', async () => {
		const key = 'b';
		const val = 'is';
		const value = sleep(val);

		expect(await cache.get(key)).to.be.undefined;
		const setPromise = cache.set(key, value);
		const getPromise1 = cache.get(key);
		const getPromise2 = cache.get(key);
		const getPromise3 = cache.get(key);

		expect(await cache.get(key)).to.equal(val);
		expect(await setPromise).to.be.true;
		expect(await getPromise1).to.equal(val);
		expect(await getPromise2).to.equal(val);
		expect(await getPromise3).to.equal(val);
	});

	it('should correctly resolve functions', async () => {
		const key = 'c';
		const val = 'really';
		const value = () => val;
		expect(await cache.get(key)).to.be.undefined;
		const promise = cache.set(key, value);
		expect(await cache.get(key)).to.equal(val);
		expect(await promise).to.be.true;
		expect(await cache.get(key)).to.equal(val);
	});

	it('should correctly resolve functions with promises', async () => {
		const key = 'd';
		const val = 'awesome';
		let counter = 0;
		const value = () => {
			counter++;
			return sleep(val);
		};

		expect(await cache.get(key)).to.be.undefined;
		const setPromise = cache.set(key, value);
		const getPromise1 = cache.get(key);
		const getPromise2 = cache.get(key);
		const getPromise3 = cache.get(key);
		expect(await cache.get(key)).to.equal(val);
		expect(await setPromise).to.be.true;
		expect(await getPromise1).to.equal(val);
		expect(await getPromise2).to.equal(val);
		expect(await getPromise3).to.equal(val);
		expect(counter).to.equal(1);
	});

	it('should correctly getOrSet', async () => {
		let key = 'e';
		let val = 'man';
		let value = val;
		expect(await cache.getOrSet(key, value)).to.equal(val);
		expect(await cache.getOrSet(key, 'anything')).to.equal(val);

		key = 'f';
		val = 'do';
		let counter = 0;
		value = () => {
			counter++;
			return sleep(val);
		};

		const promise1 = cache.getOrSet(key, value);
		const promise2 = cache.getOrSet(key, value);
		const promise3 = cache.getOrSet(key, value);
		expect(await cache.getOrSet(key, value)).to.equal(val);
		expect(await promise1).to.equal(val);
		expect(await promise2).to.equal(val);
		expect(await promise3).to.equal(val);
		expect(counter).to.equal(1);
	});

	it('should return default value when event returns undefined', async () => {
		cache.set('k', undefined);
		const value = await cache.get('k', 'default');
		expect(value).to.equal('default');
	});

	it('should correctly set ttl', async () => {
		const key = 'g';
		const value = 'you';
		expect(await cache.get(key)).to.be.undefined;
		expect(await cache.set(key, value, 20)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 10);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 7);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 4);
		expect(await cache.get(key)).to.be.undefined;
	});

	it('should correctly get stale value', async () => {
		const key = 'h';
		const value = 'val';
		await cache.set(key, value);
		cache.set(key, sleep('otherval'));
		expect(await cache.getStale(key)).to.equal(value);
		expect(await cache.get(key)).to.equal('otherval');
	});

	it('should correctly delete', async () => {
		expect(await cache.get('e')).to.equal('man');
		await cache.del('e');
		expect(await cache.get('e')).to.be.undefined;
	});

	it('should correctly check for existance', async () => {
		expect(await cache.has('d')).to.be.true;
		expect(await cache.has('d1')).to.be.false;
	});

	it('should correctly return the size', async () => {
		const cache1 = new Cache();
		expect(await cache1.size()).to.equal(0);
		expect(await cache.size()).to.equal(7);
	});

	it('should correctly clear the cache', async () => {
		expect(await cache.get('a')).to.equal('this');
		await cache.clear();
		expect(await cache.get('a')).to.be.undefined;
		expect(await cache.get('b')).to.be.undefined;
		expect(await cache.size()).to.equal(0);
	});
});

