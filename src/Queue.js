import kue from 'kue';

// This is WIP
class Queue {
	static jobs;

	constructor(name, redis = {port: 6379, host: '127.0.0.1'}) {
		this.name = name;

		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			Queue.jobs.on('error', (err) => {
				console.log('Queue error: ', err.message);
			});
			process.once('SIGTERM', () => {
				Queue.jobs.shutdown(5000, (err) => {
					console.log('Queue shutdown: ', err || '');
					process.exit(0);
				});
			});
		}
	}

	/**
	 * Add a job to the Queue
	 * @param {Object} jobData Job data
	 * @param {Number|String} priority Priority of the job
	 * @returns {Number} The ID of the job created
	 */
	async addJob(jobData, priority = 0) {
		return new Promise((resolve, reject) => {
			const job = Queue.jobs
				.create(this.name, jobData)
				.priority(priority);

			if (this.attempts) {
				job.attempts(this.attempts);
			}
			if (this.delay) {
				job.delay(this.delay).backoff(true);
			}
			if (this.removeOnComplete) {
				job.removeOnComplete(true);
			}

			job.save((err) => {
				if (!err) resolve(job.id);
				reject(new Error(err));
			});
		});
	}

	/**
	 * Set number of retry attempts for any job added after this is called
	 * @param {Number} attempts Number of attempts (>= 0)
	 */
	setAttempts(attempts) {
		this.attempts = attempts;
	}

	/**
	 * Set delay b/w successive jobs
	 * @param {Number} delay Delay b/w jobs, milliseconds
	 */
	setDelay(delay) {
		this.delay = delay;
	}

	setRemoveOnCompletion(removeOnComplete) {
		this.removeOnComplete = removeOnComplete;
	}

	/**
	 * Processor function : async
	 * @param {Object} jobData The information saved in the job during adding
	 * @param {Object} ctx Optional - Can be used to pause and resume queue
	 */

	/**
	 * Attach a processor to the Queue which will keep getting jobs as it does them
	 * @param {Function} processor An async function which will be called to process the job data
	 * @param {Number} concurrency The number of jobs this processor
	 * 		can handle concurrently/parallely
	 */
	addProcessor(processor, concurrency = 1) {
		Queue.jobs.process(this.name, concurrency, async (job, ctx, done) => {
			job.log('Start processing');
			let res;
			try {
				res = await processor(job.data, ctx);
			}
			catch (e) {
				done(new Error(this.name + ' Job failed: ' + e.message));
			}
			done(null, res);
		});
	}

	/**
	 * Process a single job in the Queue and mark it complete or failed,
	 * for when you want to manually process jobs
	 * @param {Function} processor An async function which will be called to process the job data
	 */
	async processJob(processor) {
		return new Promise((resolve, reject) => {
			kue.Job.rangeByType(this.name, 'inactive', 0, 1, 'asc', async (err, jobs) => {
				if (jobs.length === 0 || err) {
					reject(new Error('Queue empty ' + err));
				}
				const job = jobs[0];
				try {
					const res = await processor(job.data);
					job.complete(() => res);
					resolve(res);
				}
				catch (e) {
					job.failed(() => e);
					reject(new Error(e.message));
				}
			});
		});
	}

	static async status(jobId) {
		return new Promise((resolve, reject) => {
			kue.Job.get(jobId, (err, job) => {
				if (err || !job) reject(new Error('Job not found ' + err));
				job = JSON.parse(JSON.stringify(job));
				resolve(job);
			});
		});
	}
}

export default Queue;
