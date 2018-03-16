/* global describe, it, before */
/* eslint-disable no-unused-expressions */
import {expect} from 'chai';
import _ from 'lodash';
import {RedisCache} from '../src/index';

const cache = new RedisCache('test');
function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

describe('redis cache library', () => {
	before(async () => {
		await cache.clear();
	});

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

	it('should emit event after getting in getOrSet', async () => {
		await cache.set('i', 'test');
		cache.getOrSet('i');
		const value = await cache.getOrSet('i');
		expect(value).to.equal('test');
	});

	it('should return default value when event returns undefined', async () => {
		await cache.set('k', undefined);
		cache.getOrSet('k');
		const value = await cache.get('k', 'default');
		expect(value).to.equal('default');
	});

	it('should correctly set ttl', async () => {
		const key = 'g';
		const value = 'you';
		expect(await cache.get(key)).to.be.undefined;
		expect(await cache.set(key, value, 200)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 100);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 40);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 70);
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
		expect(await cache.has('d')).to.equal(1);
		expect(await cache.has('d1')).to.equal(0);
	});

	it('should correctly return the size', async () => {
		const cache1 = new RedisCache('test2');
		expect(await cache1.size()).to.equal(0);
		expect(await cache.size()).to.equal(7);
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

	it('should correctly use localCache', async () => {
		const redisCache = new RedisCache('test');

		const key = 'localCache';
		const value = 'rocks!';

		RedisCache.redisGetCount = 0;
		await cache.set(key, value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(RedisCache.redisGetCount).to.equal(0);
		expect(await redisCache.get('nonexistant')).to.be.undefined;
		expect(RedisCache.redisGetCount).to.equal(1);
		expect(await redisCache.get('nonexistant2', 'yo')).to.equal('yo');
		expect(RedisCache.redisGetCount).to.equal(2);
		expect(await redisCache.get(key)).to.equal(value);
		expect(RedisCache.redisGetCount).to.equal(2);

		RedisCache.redisGetCount = 0;
		redisCache.useLocalCache = false;
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(await redisCache.get(key)).to.equal(value);
		expect(RedisCache.redisGetCount).to.equal(4);
		redisCache.useLocalCache = true;
		// TODO: test using multiple processes
		await Promise.map(_.range(0, 50000), async () => {
			expect(await redisCache.getOrSet(key, value)).to.equal(value);
		});

		await Promise.map(_.range(0, 50000), async () => {
			expect(await redisCache.getOrSet('ahfhajsd', value)).to.equal(value);
		});
	});

	it('should correctly use parse', async () => {
		const redisCache = new RedisCache('test');
		let parseCount = 0;
		class T {
			constructor(obj) {
				this.obj = obj;
			}

			toJSON() {
				return _.toPairs(this.obj);
			}

			static async fromJSON(obj) {
				parseCount++;
				return new T(_.fromPairs(obj));
			}
		}

		const key = 'parseTest';
		const value = new T({a: 'b', c: 'd'});
		const parsed = JSON.parse(JSON.stringify(value));

		expect(await redisCache.getOrSet(
			key,
			() => value,
			{parse: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.get(
			key,
			undefined,
			{parse: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.getOrSet(
			key,
			() => value,
			{parse: T.fromJSON},
		)).to.deep.equal(value);
		redisCache.useLocalCache = false;
		expect(await redisCache.getOrSet(key, () => value)).to.not.deep.equal(value);
		expect(await redisCache.getOrSet(key, () => value)).to.deep.equal(parsed);
		expect(await redisCache.getOrSet(
			key,
			() => value,
			{parse: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.get(key)).to.deep.equal(parsed);
		expect(await redisCache.get(
			key,
			undefined,
			{parse: T.fromJSON},
		)).to.deep.equal(value);

		expect(parseCount).to.equal(2);
	});

	it('should correctly clear the cache', async () => {
		expect(await cache.get('a')).to.equal('this');
		await cache.clear();
		expect(await cache.get('a')).to.be.undefined;
		expect(await cache.get('b')).to.be.undefined;
		expect(await cache.size()).to.equal(0);
	});
});
