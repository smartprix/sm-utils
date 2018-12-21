/* eslint-disable no-unused-expressions */
import {expect} from 'chai';
import _ from 'lodash';
import {RedisCache, Vachan} from '../src/index';

const IS_PIKA = Boolean(process.env.USE_PIKA);

let conf = {};
if (IS_PIKA) {
	conf = {
		port: 9221,
		type: 'pika',
	};

	// use redis for pub sub
	// pika pub sub is very slow
	RedisCache.pubSubRedisConf = {
		port: 6379,
		type: 'redis',
	};
}

function getCache(prefix, options = {}, redisConf = {}) {
	return new RedisCache(
		prefix,
		Object.assign({}, conf, redisConf),
		options
	);
}

const cache = getCache('test');
function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

async function tick(val) {
	return new Promise(resolve => setImmediate(() => setTimeout(() => resolve(val), 1)));
}

describe('redis cache library @rediscache', () => {
	before(async () => {
		const aCache = getCache('*');
		await aCache.delContains('_all_');
	});

	after(async () => {
		const aCache = getCache('*');
		await aCache.delContains('_all_');
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

	it('should correctly set ttl', async function () {
		let multiplier = 1;
		if (IS_PIKA) {
			// pika doesn't support ttl of millisecond resolution
			this.timeout(15000);
			multiplier = 100;
		}

		const key = 'g';
		const value = 'you';
		expect(await cache.get(key)).to.be.undefined;
		expect(await cache.set(key, value, 40 * multiplier)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 20 * multiplier);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 10 * multiplier);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 20 * multiplier);
		expect(await cache.get(key)).to.be.undefined;

		cache.useLocalCache = false;
		expect(await cache.set(key, value, 40 * multiplier)).to.be.true;
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 20 * multiplier);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 10 * multiplier);
		expect(await cache.get(key)).to.equal(value);
		await sleep('', 20 * multiplier);
		expect(await cache.get(key)).to.be.undefined;
		cache.useLocalCache = true;
	});

	it('should correctly use ttl in getOrSet', async function () {
		let multiplier = 1;
		if (IS_PIKA) {
			// pika doesn't support ttl of millisecond resolution
			this.timeout(15000);
			multiplier = 100;
		}

		const aCache = getCache('getOrSet_ttl');
		const key = 'g';
		let counter = 0;
		const value = () => {
			counter++;
			return sleep(counter, 1);
		};

		const opts = {ttl: 40 * multiplier};

		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 10 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 20 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 20 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		expect(counter).to.equal(2);

		await aCache.clear();
	});

	it('should correctly use staleTTL in getOrSet', async function () {
		let multiplier = 1;
		if (IS_PIKA) {
			// pika doesn't support ttl of millisecond resolution
			this.timeout(15000);
			multiplier = 100;
		}

		const aCache = getCache('getOrSet_staleTTL');
		const key = 'g';
		let counter = 0;
		const value = () => {
			counter++;
			return sleep(counter, 0);
		};

		const opts = {
			ttl: 40 * multiplier,
			staleTTL: 20 * multiplier,
		};

		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 10 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 15 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await sleep('', 25 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(3);
		await sleep('', 50 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(4);
		expect(counter).to.equal(4);
	});

	it('should correctly use requireResult and freshResult in staleTTL', async function () {
		let multiplier = 1;
		if (IS_PIKA) {
			// pika doesn't support ttl of millisecond resolution
			this.timeout(15000);
			multiplier = 100;
		}

		const aCache = getCache('getOrSet_staleTTL_opts');
		const key = 'g';
		let counter = 0;
		const value = () => {
			counter++;
			return sleep(counter, 0);
		};

		const opts = {
			ttl: 40 * multiplier,
			staleTTL: 20 * multiplier,
			requireResult: false,
		};

		expect(await aCache.getOrSet(key, value, opts)).to.be.undefined;
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		opts.freshResult = true;
		await sleep('', 10 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(1);
		await sleep('', 15 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(2);
		await sleep('', 25 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(3);
		await tick();
		expect(await aCache.getOrSet(key, value, opts)).to.equal(3);
		await sleep('', 50 * multiplier);
		expect(await aCache.getOrSet(key, value, opts)).to.equal(4);
		expect(counter).to.equal(4);
	});

	it('should correctly use lru in local items', async () => {
		RedisCache.redisGetCount = 0;
		const aCache = getCache('getOrSet_localLRU', {maxLocalItems: 3});
		await aCache.set('a', 'b');
		await aCache.set('c', 'd');
		await aCache.set('e', 'f');
		await aCache.set('g', 'h');
		await aCache.set('i', 'j');
		await aCache.set('k', 'l');
		expect(aCache.localCache.get('g').v).to.equal('h');
		expect(aCache.localCache.get('i').v).to.equal('j');
		expect(aCache.localCache.get('k').v).to.equal('l');
		expect(await aCache.get('g')).to.equal('h');
		expect(await aCache.get('i')).to.equal('j');
		expect(await aCache.get('k')).to.equal('l');
		expect(RedisCache.redisGetCount).to.equal(0);
		expect(aCache.localCache.get('a')).to.be.undefined;
		expect(aCache.localCache.get('c')).to.be.undefined;
		expect(aCache.localCache.get('e')).to.be.undefined;
		expect(await aCache.get('a')).to.equal('b');
		expect(await aCache.get('c')).to.equal('d');
		expect(await aCache.get('e')).to.equal('f');
		expect(RedisCache.redisGetCount).to.equal(3);
		RedisCache.redisGetCount = 0;
	});

	// NOTE: below test are only for attachMap, rest of attach* functions should work similarly
	// eslint-disable-next-line max-statements
	it('should correctly attach local values', async () => {
		const aCache = getCache('localAttach', {maxLocalItems: 2});
		await aCache.set('a', 'b', 30);
		await aCache.set('c', 'd');

		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');
		expect(aCache.attachMap('c', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k2', 'v2');
		expect(aCache.attachMap('a', 'data1').get('k2')).to.equal('v2');
		expect(aCache.attachMap('a', 'data2').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data2').set('k1', 'v21');
		expect(aCache.attachMap('a', 'data2').get('k1')).to.equal('v21');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		// trigger ttl
		await sleep('', 40);
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		expect(aCache.attachMap('a', 'data2').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.set('a', 'b');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.del('a');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.del('a');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.clear();
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.delContains('a');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		// trigger lru
		await aCache.set('e', 'f');
		await aCache.set('g', 'h');
		await aCache.set('i', 'j');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');

		await aCache.set('a', 'b');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		aCache.attachMap('a', 'data1').set('k1', 'v1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.equal('v1');
		aCache.attachMap('a', 'data2').set('k1', 'v21');
		expect(aCache.attachMap('a', 'data2').get('k1')).to.equal('v21');

		await aCache.deleteAttached('a', 'data1');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		expect(aCache.attachMap('a', 'data2').get('k1')).to.equal('v21');

		await aCache.deleteAllAttached('a');
		expect(aCache.attachMap('a', 'data1').get('k1')).to.be.undefined;
		expect(aCache.attachMap('a', 'data2').get('k1')).to.be.undefined;
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
		const cache1 = getCache('test2');
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
		const redisCache = getCache('test');

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
		await Vachan.map(_.range(0, 10000), async () => {
			expect(await redisCache.getOrSet(key, value)).to.equal(value);
		});

		await Vachan.map(_.range(0, 10000), async () => {
			expect(await redisCache.getOrSet('ahfhajsd', value)).to.equal(value);
		});
	});

	it('should log writes to local cache', async () => {
		const lines = [];
		const logger = {
			log(line) {
				lines.push(line);
			},
		};

		RedisCache.logOnLocalWrite = true;
		const redisCache = getCache('test', {logger});

		const key = 'localCacheWriteTest';
		const value = {a: 'b'};

		const result = await redisCache.getOrSet(key, () => value);
		// const result = await redisCache.get(key);

		const a = result.a; // eslint-disable-line
		result.a = 'c';
		result.b = 'd';

		expect(lines.length).to.equal(2);
		expect(lines[0]).to.contain('localCacheWriteTest.a');
		expect(lines[1]).to.contain('localCacheWriteTest.b');

		RedisCache.logOnLocalWrite = false;
	});

	it('should correctly use parse', async () => {
		const redisCache = getCache('test');
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

	it('should correctly bypass the cache for instance', async () => {
		let i = 0;
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(1);
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(1);
		cache.bypass(); // turn on bypassing
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(2);
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(3);
		cache.bypass(false); // turn off bypassing
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(1);
		cache.bypass(); // turn on bypassing
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(4);
		cache.bypass(false); // turn off bypassing
		expect(await cache.getOrSet('bypass', () => ++i)).to.equal(1);
	});

	it('should correctly bypass the cache globally', async () => {
		const redisCache = getCache('test_bypass');
		await redisCache.clear();

		let i = 0;
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(1);
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(1);
		RedisCache.bypass(); // turn on bypassing
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(2);
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(3);
		RedisCache.bypass(false); // turn off bypassing
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(1);
		RedisCache.bypass(); // turn on bypassing
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(4);
		RedisCache.bypass(false); // turn off bypassing
		redisCache.bypass(false); // turn off bypassing for instance
		RedisCache.bypass(); // turn on bypassing
		expect(await redisCache.getOrSet('bypass', () => ++i)).to.equal(1);

		await redisCache.clear();
		expect(await redisCache.get('bypass')).to.be.undefined;
	});

	it('should correctly clear the cache', async () => {
		expect(await cache.get('a')).to.equal('this');
		await cache.clear();
		expect(await cache.get('a')).to.be.undefined;
		expect(await cache.get('b')).to.be.undefined;
		expect(await cache.size()).to.equal(0);
	});

	it('should correctly del contains', async () => {
		const redisCache = getCache('test_delcontains');
		await redisCache.set('xorm:category:1', {a: 1});
		await redisCache.set('xorm:category:2', {a: 2});
		await redisCache.set('xorm:category:3', {a: 3});
		await redisCache.set('xorm:product:1', {p: 1});
		await redisCache.set('xorm:product:2', {p: 2});

		expect(await redisCache.size()).to.equal(5);
		expect(await redisCache.delContains('category')).to.equal(3);
		expect(await redisCache.size()).to.equal(2);
		expect(await redisCache.get('xorm:category:1')).to.be.undefined;
		expect(await redisCache.get('xorm:product:1')).to.be.deep.equal({p: 1});
		expect(await redisCache.delContains('_all_')).to.equal(2);
		expect(await redisCache.get('xorm:product:1')).to.be.undefined;
		expect(await redisCache.size()).to.equal(0);
	});
});
