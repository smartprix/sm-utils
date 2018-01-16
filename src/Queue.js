import kue from 'kue';
import {sequentialId} from './Crypt';

// This is WIP
class Queue {
	static jobs;

	constructor(name, redis) {
		this.name = name;
		
		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			Queue.jobs.on( 'error', (err) => {
				console.log( 'Kue error: ', err );
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

	setAttempts(attempts) {
		this.attempts = attempts;
	}

	setDelay(delay) {
		this.delay = delay;
	}

	/**
	 * Attach a processor to the Queue
	 * @param {Function} processor A function which accepts three params:
	 * 		@param {Object} job Has information about the job
	 * 		@param {Object} ctx Used to pause and resume the Queue
	 * 		@param {Function} done To be called when the processing
	 * 			of the job is done or errored out
	 * @param {Number} concurrency The number of jobs this processor
	 * 		can handle concurrently 
	 */
	addProccessor(processor, concurrency = 1) {
		jobs.process(this.name, concurrency, async (job, ctx, done) => {
			try {
				await processor(job, ctx, done);
			}
			catch(e) {
				done(new Error('Job failed: ' + e.message));
			}
		});
	}
}

export default Queue;