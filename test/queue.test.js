/* global before, after, describe, it */
import {expect} from 'chai';
import {Queue} from '../src';

let queue;

function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

before(async () => {
	queue = new Queue('test');
	await queue.cleanup();
});

describe('Queue library', () => {
	let id1;
	let id2;
	let id;
	let detail;

	const testData = 'test123';

	it('should add job and return id', async () => {
		id1 = await queue.addJob({data: testData + '1'});
		id2 = await queue.addJob({data: testData + '2'});
		expect(id1).to.be.a('Number');
		expect(id2).to.be.a('Number');
	});

	it('should return inactive state in status', async () => {
		const details = await Queue.status(id1);
		expect(details.id).to.equal(id1);
		expect(details.state).to.equal('inactive');
	});

	it('should process job', async () => {
		const job = await Queue.processJobById(id1, jobData => jobData.data);
		expect(job.result).to.equal(testData + '1');
		expect(job.state).to.equal('complete');
	});

	it('should have error and complete state in status', async () => {
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
		expect(err.message).to.equal('Job failed Error: test ' + testData + '2');
	});

	it('should have error and failed state in status', async () => {
		const details = await Queue.status(id2);
		expect(details.id).to.equal(id2);
		expect(details.state).to.equal('failed');
		expect(details.error).to.equal('test ' + testData + '2');
	});

	it('should set job complete even on failure, after setting noFailure', async () => {
		queue.setNoFailure(true);
		const id3 = await queue.addJob({data: testData + '3'});
		queue.setNoFailure(false);

		const job = await Queue.processJobById(id3, async (jobData) => {
			throw new Error('test ' + jobData.data);
		});

		expect(job.result).to.equal(undefined);
		expect(job.error).to.equal('test ' + testData + '3');
		expect(job.state).to.equal('complete');
	});

	it('should be able to attach a processor', async () => {
		id = await queue.addJob('x');
		queue.addProcessor(data => 'output:' + data);
		await sleep(0, 1000);
		detail = await Queue.status(id);
		expect(detail.result).to.equal('output:x');
		expect(detail.state).to.equal('complete');
	});

	it('should process jobs after attaching processor', async () => {
		id = await queue.addJob('y');
		await sleep(0, 1000);
		detail = await Queue.status(id);
		expect(detail.result).to.equal('output:y');
		expect(detail.state).to.equal('complete');
	});
});

after(async () => {
	await Queue.exit();
});

