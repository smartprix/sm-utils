import {expect} from 'chai';
import {Queue} from '../src';

/** @type {Queue} */
let queue;

function sleep(val, timeout = 20) {
	return new Promise(resolve => setTimeout(() => resolve(val), timeout));
}

const processor = jobData => jobData.data;

before(async () => {
	queue = new Queue('test', {host: process.env.DRONE ? 'redis' : '127.0.0.1', port: 6379});
	await queue.delete(0);
});

describe('@queue library', () => {
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
		const job = await Queue.processJobById(id1, processor);
		expect(job.result).to.equal(testData + '1');
		expect(job.state).to.equal('complete');
	});

	it('should have complete state in status', async () => {
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
		id = await queue.addJob({data: 'x'});
		queue.addProcessor(processor, 2);
		await sleep(0, 500);
		detail = await Queue.status(id);
		expect(detail.result).to.equal('x');
		expect(detail.state).to.equal('complete');
	});

	it('should return existing result if job already processed', async () => {
		const job = await Queue.processJobById(id, processor);
		expect(job.result).to.equal('x');
		expect(job.state).to.equal('complete');
	});

	it('should process jobs after attaching processor', async () => {
		id = await queue.addJob({data: 'y'});
		await sleep(0, 1000);
		detail = await Queue.status(id);
		expect(detail.result).to.equal('y');
		expect(detail.state).to.equal('complete');
	});

	it('should timeout job', async () => {
		let res = {};
		try {
			await queue.addAndProcess({data: 's'}, undefined, 0);
		}
		catch (err) {
			res = err;
		}
		expect(res.message).to.equal('Timed out');
	});

	it('should pause processor', async () => {
		await queue.pauseProcessor();
		id = await queue.addJob({data: 'z'});
		await sleep(0, 1000);
		detail = await Queue.status(id);
		expect(detail.state).to.equal('inactive');
	}).timeout(8000);

	it('should give correct counts', async () => {
		const inactive = await queue.pendingJobs();
		const failed = await queue.failedJobs();
		const completed = await queue.completedJobs();
		expect(inactive).to.equal(1);
		expect(failed).to.equal(2);
		expect(completed).to.equal(4);
	});

	it('should resume processor', async () => {
		queue.resumeProcessor();
		await sleep(0, 1000);
		detail = await Queue.status(id);
		expect(detail.result).to.equal('z');
		expect(detail.state).to.equal('complete');
	}).timeout(5000);

	it('should return result on completion', async () => {
		const res = await queue.addAndProcess({data: 's'});
		expect(res).to.equal('s');
	}).timeout(5000);

	it('should delete all jobs', async () => {
		await queue.delete(0);
		const inactive = await queue.inactiveJobs();
		const completed = await queue.completedJobs();
		const failed = await queue.failedJobs();
		const delayed = await queue.delayedJobs();
		const active = await queue.activeJobs();

		expect(inactive + completed + failed + delayed + active).to.equal(0);
	});
});

after(async () => {
	await Queue.exit(100);
});

