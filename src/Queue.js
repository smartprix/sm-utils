import kue from 'kue';

// This is WIP
class Queue {
	static jobs;

	constructor(name, redis) {
		this.name = name;

		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			Queue.jobs.on('error', (err) => {
				console.log('Queue error: ', err.message);
			});
		}
	}

	/**
	 * Add a job to the Queue
	 * @param {Object} jobData Job data
	 * @param {Number|String} priority Priority of the job
	 */
	async addJob(jobData, priority = 0) {
		return new Promise((res, rej) => {
			const job = Queue.jobs
				.create(this.name, jobData)
				.priority(priority);

			if (this.attempts) {
				job.attempts(this.attempts);
			}
			if (this.delay) {
				job.delay(this.delay);
			}

			job.removeOnComplete(true)
				.save((err) => {
					if (!err) res(this);
					rej(err);
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

	/**
	 * Processor function : async
	 * @param {Object} job Has information about the job
	 * @param {Object} ctx Used to pause and resume the Queue
	 * @param {Function} done To be called when the processing
	 * 		of the job is done or errored out
	 */

	/**
	 * Attach a processor to the Queue
	 * @param {Function} processor An async function which will be called to process the job
	 * @param {Number} concurrency The number of jobs this processor
	 * 		can handle concurrently/parallely
	 */
	addProcessor(processor, concurrency = 1) {
		Queue.jobs.process(this.name, concurrency, async (job, ctx, done) => {
			try {
				await processor(job, ctx, done);
			}
			catch (e) {
				done(new Error(this.name + ' Job failed: ' + e.message));
			}
		});
	}
}

export default Queue;
