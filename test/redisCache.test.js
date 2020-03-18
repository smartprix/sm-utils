/* eslint-disable no-unused-expressions, max-statements */
import {expect} from 'chai';
import path from 'path';
import _ from 'lodash';
import Workerpool from 'workerpool';
import {RedisCache, Vachan} from '../src/index';

let workerpool = Workerpool.pool({workerType: 'process'});
const IS_PIKA = Boolean(process.env.USE_PIKA);
const IS_DRONE = Boolean(process.env.DRONE);

let conf = {
	host: IS_DRONE ? 'redis' : '127.0.0.1',
};

let pubSubRedisConf = {
	host: IS_DRONE ? 'redis' : '127.0.0.1',
};

if (IS_PIKA) {
	conf = {
		port: 9221,
		type: 'pika',
		host: IS_DRONE ? 'pika' : '127.0.0.1',
	};

	// use redis for pub sub
	// pika pub sub is very slow
	pubSubRedisConf = {
		port: 6379,
		type: 'redis',
		host: IS_DRONE ? 'redis' : '127.0.0.1',
	};
}
RedisCache.pubSubRedisConf = pubSubRedisConf;
conf.pubSubRedisConf = pubSubRedisConf;

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

async function workerFunc(indexPath, opts, command) {
	require('@babel/register');  // eslint-disable-line
	const {RedisCache} = require(indexPath); // eslint-disable-line
	const redisConf = opts.conf;
	RedisCache.pubSubRedisConf = redisConf.pubSubRedisConf || {};
	const prefix = opts.prefix || 'worker_redis';
	const wCache = new RedisCache(prefix, redisConf, opts);

	const ret = [];
	ret.push(await wCache.get('aw'));

	if (command === 'set') {
		await wCache.set('aw', 'bw');
	}
	else if (command === 'del') {
		await wCache.del('aw');
	}
	else if (command === 'clear') {
		await wCache.clear('aw');
	}
	else if (command === 'del_contains') {
		await wCache.delContains('aw');
	}

	ret.push(await wCache.get('aw'));
	return ret;
}

async function workerExec(command, opts = {}) {
	const indexPath = path.join(__dirname, '../src/index');
	return workerpool.exec(workerFunc, [indexPath, {conf, ...opts}, command]);
}

describe('redis cache library @rediscache', () => {
	before(async () => {
		const aCache = getCache('*');
		await aCache.delContains('_all_');
	});

	after(async () => {
		if (workerpool) {
			workerpool.terminate();
			workerpool = null;
		}
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

	it('should delete values', async () => {
		await cache.set('k1', 'v1');
		expect(await cache.get('k1')).to.equal('v1');
		await cache.del('k1');
		expect(await cache.get('k1')).to.be.undefined;
		await cache.set('k1', 'v1');
		await cache.set('k2', 'v2');
		await cache.set('k3', 'v3');
		expect(await cache.get('k2')).to.equal('v2');
		expect(await cache.get('k3')).to.equal('v3');
		await cache.del(['k2', 'k3']);
		expect(await cache.get('k2')).to.be.undefined;
		expect(await cache.get('k3')).to.be.undefined;
		expect(await cache.get('k1')).to.equal('v1');
		await cache.del(['k1']);
		expect(await cache.get('k1')).to.be.undefined;
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

	it('should correctly dogpile getOrSet', async () => {
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

	it('should correctly dogpile getOrSet staleTTL', async () => {
		const aCache = getCache('getOrSet_staleTTL_dogpile');

		let key = 'e';
		let val = 'man';
		let value = val;
		expect(await aCache.getOrSet(key, value, {staleTTL: '1d'})).to.equal(val);
		expect(await aCache.getOrSet(key, 'anything', {staleTTL: '1d'})).to.equal(val);

		key = 'f';
		val = 'do';
		let counter = 0;
		value = () => {
			counter++;
			return sleep(val);
		};

		const promise1 = aCache.getOrSet(key, value, {staleTTL: '1d'});
		const promise2 = aCache.getOrSet(key, value, {staleTTL: '1d'});
		const promise3 = aCache.getOrSet(key, value, {staleTTL: '1d'});
		expect(await aCache.getOrSet(key, value, {staleTTL: '1d'})).to.equal(val);
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

	it('should correctly getLocalCacheStats', async () => {
		const stats = await RedisCache.getLocalCacheStats();
		expect(stats.slice(0, 2)).to.deep.equal([
			{
				prefix: 'test',
				type: 'Map',
				maxItems: 0,
				items: 7,
				totalItems: 7,
			},
			{
				prefix: 'getOrSet_localLRU',
				type: 'LRU',
				maxItems: 3,
				items: 3,
				totalItems: 3,
			},
		]);
	});

	// NOTE: below test are only for attachMap, rest of attach* functions should work similarly
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

	it('should not clear local cache on set for current process', async () => {
		const aCache = getCache('clearLocal_current');
		await aCache.set('a', 'b');
		expect(aCache.localCache.get('a').v).to.equal('b');
		expect(await aCache.get('a')).to.equal('b');
		await aCache.set('a', 'd');
		expect(aCache.localCache.get('a').v).to.equal('d');
		expect(await aCache.get('a')).to.equal('d');
		// allow some time for publish to be synchronized
		await sleep('', 100);
		expect(aCache.localCache.get('a').v).to.equal('d');
		expect(await aCache.get('a')).to.equal('d');
	});

	it('should clear local cache on set for different process', async function () {
		this.timeout(10000);

		/* eslint-disable */
		const result = [];

		const aCache = getCache('worker_redis');
		await aCache.set('aw', 'b');
		expect(aCache.localCache.get('aw').v).to.equal('b');
		expect(await aCache.get('aw')).to.equal('b');

		const exec = workerExec;
		result.push(await exec('set'));

		// allow publish to be synchronized
		await sleep('', 50);

		expect(aCache.localCache.get('aw')).to.be.undefined;
		expect(await aCache.get('aw')).to.equal('bw');
		expect(aCache.localCache.get('aw').v).to.be.equal('bw');

		result.push(await exec('del'));

		// allow publish to be synchronized
		await sleep('', 50);

		expect(aCache.localCache.get('aw')).to.be.undefined;
		expect(await aCache.get('aw')).to.be.undefined;
		await aCache.set('aw', 'b');
		expect(await aCache.get('aw')).to.equal('b');
		expect(aCache.localCache.get('aw').v).to.be.equal('b');

		result.push(await exec('clear'));

		// allow publish to be synchronized
		await sleep('', 50);

		expect(aCache.localCache.get('aw')).to.be.undefined;
		expect(await aCache.get('aw')).to.be.undefined;
		await aCache.set('aw', 'b');
		expect(await aCache.get('aw')).to.equal('b');
		expect(aCache.localCache.get('aw').v).to.be.equal('b');

		result.push(await exec('del_contains'));

		// allow publish to be synchronized
		await sleep('', 50);

		expect(aCache.localCache.get('aw')).to.be.undefined;
		expect(await aCache.get('aw')).to.be.undefined;
		await aCache.set('aw', 'b');
		expect(await aCache.get('aw')).to.equal('b');
		expect(aCache.localCache.get('aw').v).to.be.equal('b');

		// test attach
		expect(aCache.attachMap('aw', 'data').get('k1')).to.be.undefined;
		aCache.attachMap('aw', 'data').set('k1', 'v1');
		expect(aCache.attachMap('aw', 'data').get('k1')).to.equal('v1');

		result.push(await exec('set'));

		// allow publish to be synchronized
		await sleep('', 50);

		expect(aCache.attachMap('aw', 'data').get('k1')).to.be.undefined;
		expect(aCache.localCache.get('aw').v).to.be.undefined;

		expect(result).to.deep.equal([['b', 'bw'], ['bw', null], ['b', null], ['b', null], ['b', 'bw']]);
		/* eslint-enable */
		/* eslint-disable no-unused-expressions */
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

	it('should correctly use process', async () => {
		const redisCache = getCache('test');
		let processCount = 0;
		class T {
			constructor(obj) {
				this.obj = obj;
			}

			toJSON() {
				return _.toPairs(this.obj);
			}

			static async fromJSON(obj) {
				processCount++;
				return new T(_.fromPairs(obj));
			}
		}

		let key = 'processTest';
		const obj = {a: 'b', c: 'd'};
		const value = new T(obj);
		const parsed = JSON.parse(JSON.stringify(value));

		// process after setting and returning
		expect(await redisCache.getOrSet(
			key,
			() => value.toJSON(),
			{process: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.get(key)).to.deep.equal(value);
		redisCache._localDel(key);
		expect(await redisCache.getOrSet(
			key,
			() => 1,
			{process: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.getOrSet(
			key,
			() => 1,
			{process: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.get(key)).to.deep.equal(value);

		// process after parse
		key = `${key}2`;
		expect(await redisCache.getOrSet(
			key,
			() => value,
			{parse: T.fromJSON, process: v => v.obj},
		)).to.deep.equal(obj);
		expect(await redisCache.get(key)).to.deep.equal(obj);
		redisCache._localDel(key);
		expect(await redisCache.getOrSet(
			key,
			() => 1,
			{parse: T.fromJSON, process: v => v.obj},
		)).to.deep.equal(obj);
		expect(await redisCache.get(key)).to.deep.equal(obj);

		// process after fetching from redis
		key = `${key}3`;
		redisCache.useLocalCache = false;
		expect(await redisCache.getOrSet(
			key,
			() => value.toJSON(),
			{process: T.fromJSON},
		)).to.deep.equal(value);
		expect(await redisCache.get(key)).to.deep.equal(parsed);

		// process while setting in localCache
		key = `${key}4`;
		redisCache.useLocalCache = true;
		redisCache.useRedisCache = false;
		expect(await redisCache.getOrSet(
			key,
			() => value,
			{process: v => v.toJSON()},
		)).to.deep.equal(parsed);
		expect(await redisCache.get(key)).to.deep.equal(parsed);

		// process while bypassed
		key = `${key}5`;
		redisCache.bypass(true);
		expect(await redisCache.getOrSet(
			key,
			() => value.toJSON(),
			{process: T.fromJSON},
		)).to.deep.equal(value);

		expect(processCount).to.equal(5);

		redisCache.bypass(false);
		redisCache.useLocalCache = true;
		redisCache.useRedisCache = true;
	});

	it('should correctly use toJSON', async () => {
		const redisCache = getCache('test');
		const key = 'toJSONTest';

		expect(await redisCache.getOrSet(
			key,
			() => '123',
			{toJSON: () => 234},
		)).to.deep.equal('123');
		expect(await redisCache.get(key)).to.deep.equal('123');
		redisCache._localDel(key);
		expect(await redisCache.get(key)).to.deep.equal(234);
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

		RedisCache.bypass(false); // turn off bypassing
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

	// eslint-disable-next-line
	it('should correctly handle useRedisCache=false', async () => {
		const fns = [
			'_get',
			'_set',
			'_del',
			'_has',
			'_size',
			'_delPattern',
			'_clear',
		];

		// mock redis call functions
		fns.forEach((fn) => {
			RedisCache.prototype[`_original_${fn}`] = RedisCache.prototype[fn];
			RedisCache.prototype[fn] = (...args) => {
				throw new Error(`Redis.${fn} called with args: ${JSON.stringify(args)}`);
			};
		});

		const prefix = 'test_useRedisCache';
		const redisCache = getCache(prefix, {useRedisCache: false});

		RedisCache.redisGetCount = 0;
		await redisCache.set('a', 'a1');
		expect(await redisCache.get('a')).to.equal('a1');
		expect(await redisCache.get('nonexistant')).to.be.undefined;
		expect(await redisCache.get('nonexistant2', 'yo')).to.equal('yo');

		let counter = 0;
		const value = () => {
			counter++;
			return sleep('b1');
		};

		const promise1 = redisCache.getOrSet('b', value);
		const promise2 = redisCache.getOrSet('b', value);
		const promise3 = redisCache.getOrSet('b', value);
		expect(await redisCache.getOrSet('b', value)).to.equal('b1');
		expect(await promise1).to.equal('b1');
		expect(await promise2).to.equal('b1');
		expect(await promise3).to.equal('b1');
		expect(counter, 'getOrSet counter is wrong').to.equal(1);

		expect(await redisCache.has('a')).to.be.true;
		expect(await redisCache.has('b')).to.be.true;
		expect(await redisCache.has('c')).to.be.false;

		expect(await redisCache.size()).to.equal(2);

		await redisCache.del('b');
		expect(await redisCache.has('b')).to.be.false;
		expect(await redisCache.get('b')).to.be.undefined;
		expect(await redisCache.getOrSet('b', value)).to.equal('b1');
		expect(counter).to.equal(2);

		await redisCache.set('a1', 'a11');
		await redisCache.set('a2', 'a21');
		expect(await redisCache.delContains('a')).to.equal(3);
		expect(await redisCache.get('a')).to.be.undefined;
		expect(await redisCache.get('a1')).to.be.undefined;
		expect(await redisCache.get('a2')).to.be.undefined;

		expect(await redisCache.get('b')).to.equal('b1');
		await redisCache.clear();
		expect(await redisCache.get('b')).to.be.undefined;

		// test sync
		const result = [];
		await redisCache.set('aw', 'b');
		expect(await redisCache.get('aw')).to.equal('b');

		const exec = workerExec;
		result.push(await exec('set', {useRedisCache: false}));
		// allow publish to be synchronized
		await sleep('', 50);
		// prefix was different, so value should not be deleted
		expect(await redisCache.get('aw')).to.equal('b');

		result.push(await exec('set', {useRedisCache: false, prefix}));
		// allow publish to be synchronized
		await sleep('', 50);
		expect(await redisCache.get('aw')).to.be.undefined;

		await redisCache.set('aw', 'bw');
		expect(await redisCache.get('aw')).to.equal('bw');
		result.push(await exec('del', {useRedisCache: false, prefix}));
		// allow publish to be synchronized
		await sleep('', 50);
		expect(await redisCache.get('aw')).to.be.undefined;

		expect(result).to.deep.equal([['bw', 'bw'], [null, 'bw'], [null, null]]);

		// restore original functions
		fns.forEach((fn) => {
			RedisCache.prototype[fn] = RedisCache.prototype[`_original_${fn}`];
			delete RedisCache.prototype[`_original_${fn}`];
		});
	});

	it('should throw error if error in value function', async () => {
		const getValue = function () {
			throw new Error('Error in getValue');
		};
		let errorMsg;
		try {
			await cache.getOrSet('a', getValue);
		}
		catch (err) {
			errorMsg = err.message;
		}
		expect(errorMsg).to.equal('Error in getValue');
	});

	describe('unhandled rejections', () => {
		const unhandledRejections = [];
		const unhandledRejectionListener = (reason) => {
			unhandledRejections.push(reason);
		};
		before(() => {
			process.on('unhandledRejection', unhandledRejectionListener);
		});

		it('should not throw unhandled rejection while setting in background', async () => {
			const getValue = function () {
				throw new Error('Error in getValue');
			};
			const result = await cache.getOrSet('bg', 5, {staleTTL: 1});
			await Vachan.sleep(5);
			expect(await cache.getOrSet('bg', getValue, {staleTTL: 1})).to.equal(result);
			await Vachan.sleep(100);
			expect(unhandledRejections.length).to.equal(0);
		});

		after(() => {
			process.removeListener('unhandledRejection', unhandledRejectionListener);
		});
	});
});
