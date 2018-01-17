/* global after, describe, it */
import {expect} from 'chai';
import {Queue} from '../src';

const queue = new Queue('test');

describe('Queue library', () => {
	let id1;
	let id2;
	const testData = 'test123';
	it('should add job and return id', async () => {
		id1 = await queue.addJob({data: testData});
		id2 = await queue.addJob({data: testData});
		expect(id1).to.be.a('Number');
		expect(id2).to.be.a('Number');
	});
	it('should return inactive state in status', async () => {
		const details = await Queue.status(id1);
		expect(details.id).to.equal(id1);
		expect(details.state).to.equal('inactive');
	});
	it('should process job', async () => {
		const res = await Queue.processJobById(id1, jobData => jobData.data);
		expect(res).to.equal(testData);
	});
	it('should return complete state in status', async () => {
		const details = await Queue.status(id1);
		expect(details.id).to.equal(id1);
		expect(details.state).to.equal('complete');
	});
	it('should throw error', async () => {
		let err;
		try {
			await Queue.processJobById(id2, async (jobData) => {
				throw new Error('test ' + jobData.data);
			});
		}
		catch (e) {
			err = e;
		}
		expect(err.message).to.equal('Job failed Error: test ' + testData);
	});
	it('should return failed state in status', async () => {
		const details = await Queue.status(id2);
		expect(details.id).to.equal(id2);
		expect(details.state).to.equal('failed');
	});
});

after(() => {
	Queue.jobs.shutdown(1000, () => {});
});

