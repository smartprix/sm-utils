/* eslint-disable no-unused-expressions */

import {expect} from 'chai';
import {Cache} from '../src/index';

const cache = new Cache();
function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

describe('cache library @cache', () => {
	it('should get and set values', async () => {
		const key = 'a';
		const value = 'this';
		expect(await cache.get(key)).to.be.undefined;
		expect(await cache.set(key, value)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
	});

	it('should getSync and setSync values', () => {
		const key = 'aSync';
		const value = 'this';
		expect(cache.getSync(key)).to.be.undefined;
		expect(cache.setSync(key, value)).to.be.true;
		expect(cache.getSync(key)).to.equal(value);
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

	it('should correctly resolve sync functions', () => {
		const key = 'cSync';
		const val = 'really';
		const value = () => val;
		expect(cache.getSync(key)).to.be.undefined;
		const result = cache.setSync(key, value);
		expect(cache.getSync(key)).to.equal(val);
		expect(result).to.be.true;
		expect(cache.getSync(key)).to.equal(val);
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

	it('should correctly getOrSetSync', () => {
		let key = 'eSync';
		let val = 'man';
		let value = val;
		expect(cache.getOrSetSync(key, value)).to.equal(val);
		expect(cache.getOrSetSync(key, 'anything')).to.equal(val);

		key = 'fSync';
		val = 'do';
		let counter = 0;
		value = () => {
			counter++;
			return val;
		};

		const result1 = cache.getOrSetSync(key, value);
		const result2 = cache.getOrSetSync(key, value);
		const result3 = cache.getOrSetSync(key, value);
		expect(cache.getOrSetSync(key, value)).to.equal(val);
		expect(result1).to.equal(val);
		expect(result2).to.equal(val);
		expect(result3).to.equal(val);
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
		await sleep('', 5);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 6);
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

	it('should correctly delSync', () => {
		expect(cache.getSync('eSync')).to.equal('man');
		cache.delSync('eSync');
		expect(cache.getSync('eSync')).to.be.undefined;
	});

	it('should correctly check for existance', async () => {
		expect(await cache.has('d')).to.be.true;
		expect(await cache.has('d1')).to.be.false;
	});

	it('should correctly check for sync existance', () => {
		expect(cache.hasSync('d')).to.be.true;
		expect(cache.hasSync('d1')).to.be.false;
	});

	it('should correctly return the size and sizeSync', async () => {
		const cache1 = new Cache();
		expect(await cache1.size()).to.equal(0);
		expect(await cache.size()).to.equal(9);
		expect(await cache.size()).to.equal(cache.sizeSync());
	});

	it('should correctly memoize a function', async () => {
		let count = 0;
		const sum = cache.memoize('myFunc', (a, b) => {
			count++;
			return a + b;
		});

		expect(await sum(1, 2)).to.equal(3);
		expect(await sum(2, 3)).to.equal(5);
		await sum(1, 2);
		await sum(1, 2);
		await sum(1, 2);
		await sum(2, 3);
		expect(count).to.equal(2);
	});

	it('should correctly memoizeSync a function', () => {
		let count = 0;
		const sum = cache.memoizeSync('myFuncSync', (a, b) => {
			count++;
			return a + b;
		});

		expect(sum(1, 2)).to.equal(3);
		expect(sum(2, 3)).to.equal(5);
		sum(1, 2);
		sum(1, 2);
		sum(1, 2);
		sum(2, 3);
		expect(count).to.equal(2);
	});

	it('should correctly clear the cache', async () => {
		expect(await cache.get('a')).to.equal('this');
		await cache.clear();
		expect(await cache.get('a')).to.be.undefined;
		expect(await cache.get('b')).to.be.undefined;
		expect(await cache.size()).to.equal(0);
	});

	it('should correctly clear cache on clearSync', () => {
		cache.setSync('a', 'b');
		expect(cache.sizeSync()).to.equal(1);
		expect(cache.getSync('a')).to.equal('b');
		cache.clearSync();
		expect(cache.sizeSync()).to.equal(0);
		expect(cache.getSync('a')).to.be.undefined;
	});

	it('should correctly use lru', async () => {
		const aCache = new Cache({maxItems: 3});
		await aCache.set('a', 'b');
		await aCache.set('c', 'd');
		await aCache.set('e', 'f');
		await aCache.set('g', 'h');
		await aCache.set('i', 'j');
		await aCache.set('k', 'l');
		expect(await aCache.get('a')).to.be.undefined;
		expect(await aCache.get('c')).to.be.undefined;
		expect(await aCache.get('e')).to.be.undefined;
		expect(await aCache.get('g')).to.equal('h');
		expect(await aCache.get('i')).to.equal('j');
		expect(await aCache.get('k')).to.equal('l');
		await aCache.set('a', 'b');
		await aCache.get('k');
		await aCache.get('g');
		await aCache.get('a');
		await aCache.set('m', 'n');
		await aCache.get('g');
		expect(await aCache.get('c')).to.be.undefined;
		expect(await aCache.get('e')).to.be.undefined;
		expect(await aCache.get('k')).to.be.undefined;
		expect(await aCache.get('i')).to.be.undefined;
		expect(await aCache.get('a')).to.equal('b');
		expect(await aCache.get('g')).to.equal('h');
		expect(await aCache.get('m')).to.equal('n');
	});

	it('should correctly gc a cache', async () => {
		const aCache = new Cache();
		aCache.set('a', 'b', 20);
		aCache.set('c', 'd', 20);
		aCache.set('e', 'f', 20);
		aCache.set('g', 'h', 35);
		aCache.set('i', 'j', 50);
		aCache.set('k', 'l', 50);

		expect(await aCache.size()).to.equal(6);
		await sleep('', 10);
		await aCache.gc();
		expect(await aCache.size()).to.equal(6);
		aCache.gcSync();
		expect(await aCache.size()).to.equal(6);
		await sleep('', 20);
		await aCache.gc();
		expect(await aCache.size()).to.equal(3);
		await sleep('', 10);
		aCache.gcSync();
		expect(await aCache.size()).to.equal(2);
		expect(await aCache.get('a')).to.be.undefined;
		expect(await aCache.get('k')).to.equal('l');
	});
});
