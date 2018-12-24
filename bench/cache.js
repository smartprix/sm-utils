import _ from 'lodash';
import Redis from 'ioredis';
import levelup from 'levelup';
import leveldown from 'leveldown';
import level from 'level-rocksdb';
import Knex from 'knex';
import {RedisCache, Cache, Vachan, LRU as SmLRU} from '../src';

const iterations = 100000;
const range = _.range(0, iterations);

class MapCache {
	constructor() {
		this.data = new Map();
	}

	get(key) {
		return this.data.get(key);
	}

	set(key, value) {
		this.data.set(key, value);
		return true;
	}

	del(key) {
		return this.data.delete(key);
	}

	clear() {
		this.data = new Map();
	}
}

class ObjectCache {
	constructor() {
		this.data = {};
	}

	get(key) {
		return this.data[key];
	}

	set(key, value) {
		this.data[key] = value;
		return true;
	}

	del(key) {
		delete this.data[key];
	}

	clear() {
		this.data = {};
	}
}

class RawRedisCache {
	constructor(prefix, port) {
		this.prefix = prefix;
		this.redis = new Redis({
			port,
		});
	}

	get(key) {
		return this.redis.get(`RCBench:${this.prefix}:${key}`);
	}

	set(key, value, ttl) {
		if (ttl) {
			return this.redis.set(`RCBench:${this.prefix}:${key}`, value, 'PX', ttl);
		}
		return this.redis.set(`RCBench:${this.prefix}:${key}`, value);
	}

	del(key) {
		return this.redis.del(`RCBench:${this.prefix}:${key}`);
	}

	clear() {
		return this.redis.eval(
			`for i, name in ipairs(redis.call('KEYS', 'RCBench:${this.prefix}:*')) do redis.call('UNLINK', name); end`,
			0,
		);
	}
}

class SmLRUCache {
	constructor() {
		this.data = new SmLRU({maxSize: 10000});
	}

	get(key) {
		return this.data.get(key);
	}

	set(key, value) {
		this.data.set(key, value);
		return true;
	}

	del(key) {
		return this.data.delete(key);
	}

	clear() {
		this.data.clear();
	}
}

class PostgresCache {
	constructor() {
		this.knex = Knex({
			client: 'pg',
			connection: {
				database: 'test',
				user: 'root',
				password: 'smartprix',
			},
		});
	}

	async init() {
		await this.knex.schema.dropTableIfExists('bench');
		await this.knex.schema.createTable('bench', (table) => {
			table.string('key').primary();
			table.text('value');
		});
	}

	async get(key) {
		const result = await this.knex('bench').select('value').where('key', key);
		return result.value;
	}

	async set(key, value) {
		await this.knex.raw(
			'INSERT INTO bench (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=?',
			[key, value, value],
		);
		return true;
	}

	async del(key) {
		await this.knex('bench').where('key', key).delete();
	}

	async clear() {
		await this.knex('bench').truncate();
	}
}

class RocksCache {
	constructor() {
		this.data = level('./rocks');
	}

	async get(key) {
		return this.data.get(key);
	}

	async set(key, value) {
		await this.data.put(key, value);
		return true;
	}

	async del(key) {
		return this.data.del(key);
	}

	clear() {
		// this.data.clear();
	}
}

class LevelCache {
	constructor() {
		this.data = levelup(leveldown('./level'));
	}

	async get(key) {
		return this.data.get(key);
	}

	async set(key, value) {
		await this.data.put(key, value);
		return true;
	}

	async del(key) {
		return this.data.del(key);
	}

	clear() {
		// this.data.clear();
	}
}

async function get(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		await cache.get(`yoman:${i}`);
	}
}

async function getSync(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		cache.get(`yoman:${i}`);
	}
}

async function getParallel(cache) {
	await Vachan.map(range, async (i) => {
		await cache.get(`yoman:${i}`);
	}, {concurrency: 10});
}

async function set(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		await cache.set(`yoman:${i}`, `${i}`);
	}
}

async function setParallel(cache) {
	await Vachan.map(range, async (i) => {
		await cache.set(`yoman:${i}`, `${i}`);
	}, {concurrency: 10});
}

async function setTTL(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		await cache.set(`yoman:${i}`, `${i}`, 1000000);
	}
}

async function del(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		await cache.del(`yoman:${i}`);
	}
}

async function delParallel(cache) {
	for (let i = 0; i < iterations; i++) {
		// eslint-disable-next-line no-await-in-loop
		await cache.del(`yoman:${i}`);
	}
}

async function bench(cache, label) {
	console.log(`------- ${label} ----------`);
	if (cache.init) await cache.init();

	console.time('add');
	await set(cache);
	console.timeEnd('add');

	console.time('get');
	await get(cache);
	console.timeEnd('get');

	console.time('getSync');
	await getSync(cache);
	console.timeEnd('getSync');

	console.time('set');
	await set(cache);
	console.timeEnd('set');

	console.time('del');
	await del(cache);
	console.timeEnd('del');

	console.time('setParallel');
	await setParallel(cache);
	console.timeEnd('setParallel');

	console.time('getParallel');
	await getParallel(cache);
	console.timeEnd('getParallel');

	console.time('delParallel');
	await delParallel(cache);
	console.timeEnd('delParallel');

	console.time('setTTL');
	await setTTL(cache);
	console.timeEnd('setTTL');

	console.time('clear');
	try {
		await cache.clear();
	}
	catch (e) {
		console.error(e);
	}
	console.timeEnd('clear');

	console.log('\n');
}

async function main() {
	// await bench(new ObjectCache(), 'Object Cache');
	// await bench(new MapCache(), 'Map Cache');
	// const cache = new Cache();
	// await bench(cache, 'Cache');
	// await bench(new SmLRUCache(), 'SM LRU Cache');
	await bench(new LevelCache(), 'Level Cache');
	await bench(new RocksCache(), 'Rocks Cache');
	await bench(new RawRedisCache('benchraw'), 'Raw Redis Cache');
	await bench(new RawRedisCache('benchraw', 16379), 'ARDB Cache');
	await bench(new RawRedisCache('benchraw', 9221), 'Pika Cache');
	// await bench(new PostgresCache(), 'Postgres Cache');
	// const redisCache1 = new RedisCache('bench1');
	// await bench(redisCache1, 'RedisCache');
	// const redisCache2 = new RedisCache('bench2', {useLocalCache: false});
	// await bench(redisCache2, 'RedisCache noLocal');
}

Vachan.exit(main);
