/* global describe, it, before, after */
/* eslint-disable no-unused-expressions, max-nested-callbacks */

import {expect} from 'chai';
import {Lock} from '../src/index';

let lock;

describe('Lock library', () => {
	before(async () => {
		lock = new Lock();
		await lock.release('a');
		await lock.release('b');
		await lock.release('c');
	});

	describe('tryAcquire()', () => {
		it('returns true when lock is acquired', async () => {
			const lockAcquired = await lock.tryAcquire('a');
			expect(lockAcquired).to.be.true;
		});

		it('returns false when lock is not acquired', async () => {
			const lockAcquired = await lock.tryAcquire('a');
			expect(lockAcquired).to.be.false;
		});

		it('gives lock to only one call when called concurrently', async () => {
			const promiseOne = lock.tryAcquire('b');
			const promiseTwo = lock.tryAcquire('b');
			const lockAcquiredOne = await promiseOne;
			const lockAcquiredTwo = await promiseTwo;

			expect(lockAcquiredOne).to.be.true;
			expect(lockAcquiredTwo).to.be.false;
		});

		after(async () => {
			await lock.release('a');
			await lock.release('b');
		});
	});

	describe('release()', () => {
		it('deletes the key from redis', async () => {
			await lock.tryAcquire('a');
			expect(await lock._has('a')).to.be.true;

			await lock.release('a');
			expect(await lock._has('a')).to.be.false;
		});

		it('emits release event', async () => {
			let value = false;
			lock.once('released', () => {
				value = true;
			});

			await lock.tryAcquire('a');
			await lock.release('a');
			expect(value).to.be.true;
		});

		it('does not emit release event when no key exists in redis', async () => {
			let value = false;
			lock.once('released', () => {
				value = true;
			});

			await lock.release('a');
			expect(value).to.be.false;
		});
	});

	describe('acquire()', () => {
		it('acquires a lock if immediately if available', async () => {
			const timeStart = process.hrtime();
			await lock.acquire('a');
			const elapsed = process.hrtime(timeStart);
			const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);

			expect(await lock._has('a')).to.be.true;
			expect(elapsedMs).to.be.below(5);
		});

		it('waits and acquires a lock if not available', async () => {
			await lock.tryAcquire('b');
			setTimeout(async () => {
				await lock.release('b');
			}, 100);

			const timeStart = process.hrtime();
			await lock.acquire('b');
			const elapsed = process.hrtime(timeStart);
			const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);

			expect(await lock._has('b')).to.be.true;
			expect(elapsedMs).to.be.above(100);
			expect(elapsedMs).to.be.below(105);
		});

		it('waits and acquires locks when called concurrently', async () => {
			const promiseOne = lock.acquire('c');
			const promiseTwo = lock.acquire('c');
			const promiseThree = lock.acquire('c');

			setTimeout(async () => {
				await lock.release('c');
			}, 100);
			setTimeout(async () => {
				await lock.release('c');
			}, 200);

			const timeStart = process.hrtime();

			await promiseOne;
			let elapsed = process.hrtime(timeStart);
			let elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
			expect(elapsedMs).to.be.below(5);
			expect(lock.acquireQueue.c).to.have.lengthOf(2);

			await promiseTwo;
			elapsed = process.hrtime(timeStart);
			elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
			expect(elapsedMs).to.be.above(100);
			expect(elapsedMs).to.be.below(105);
			expect(lock.acquireQueue.c).to.have.lengthOf(1);

			await promiseThree;
			elapsed = process.hrtime(timeStart);
			elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
			expect(elapsedMs).to.be.above(200);
			expect(elapsedMs).to.be.below(205);
			expect(lock.acquireQueue.c).to.be.undefined;
		});

		after(async () => {
			await lock.release('a');
			await lock.release('b');
			await lock.release('c');
		});
	});
});
