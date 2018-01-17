'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _kue = require('kue');

var _kue2 = _interopRequireDefault(_kue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Queue {

	constructor(name, redis = { port: 6379, host: '127.0.0.1' }) {
		this.name = name;

		if (!Queue.jobs) {
			Queue.jobs = _kue2.default.createQueue({
				redis
			});
			Queue.jobs.on('error', err => {
				console.log('Queue error: ', err.message);
			});
			process.once('SIGTERM', () => {
				Queue.jobs.shutdown(5000, err => {
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
			const job = Queue.jobs.create(this.name, jobData).priority(priority);

			if (this.attempts) {
				job.attempts(this.attempts);
			}
			if (this.delay) {
				job.delay(this.delay).backoff(true);
			}
			if (this.removeOnComplete) {
				job.removeOnComplete(true);
			}

			job.save(err => {
				if (err) reject(new Error(err));
				resolve(job.id);
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
  * Sets removeOnComplete for any job added to this Queue from now on
  * @param {Boolean} removeOnComplete True/False
  */
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
			} catch (e) {
				done(new Error(this.name + ' Job failed: ' + e.message));
			}
			done(null, res);
		});
	}

	/**
  * Process a single job in the Queue and mark it complete or failed,
  * for when you want to manually process jobs
  * @param {Function} processor An async function which will be called to process the job data
  * @returns {Object} Result of processor function and jobId of completed job
  */
	async processJob(processor) {
		return new Promise((resolve, reject) => {
			_kue2.default.Job.rangeByType(this.name, 'inactive', 0, 1, 'asc', async (err, jobs) => {
				if (jobs.length === 0 || err) {
					reject(new Error('Queue empty ' + err));
				}
				const job = jobs[0];
				try {
					const res = await processor(job.data);
					job.complete();
					resolve({ res, jobId: job.id });
				} catch (e) {
					job.failed();
					reject(new Error('Job failed ' + e));
				}
			});
		});
	}

	/**
  * Function to query the status of a job
  * @param {Number} jobId Job id for which status info is required
  * @returns {Object} Object full of job details like state, time, attempts, etc.
  */
	static async status(jobId) {
		return new Promise((resolve, reject) => {
			_kue2.default.Job.get(jobId, (err, job) => {
				if (err || !job) reject(new Error('Job not found ' + err));
				job = JSON.parse(JSON.stringify(job));
				resolve(job);
			});
		});
	}

	/**
  * Manualy process a specific Job
  * @param {Number} jobId Id of the job to be processed
  * @param {Function} processor The function which will be called with the job data
  * @returns {*} Result of the processor function
  */
	static async processJobById(jobId, processor) {
		return new Promise((resolve, reject) => {
			_kue2.default.Job.get(jobId, async (err, job) => {
				if (err) reject(new Error('Could not fetch job' + err));
				try {
					const res = await processor(job.data);
					job.complete();
					resolve(res);
				} catch (e) {
					job.failed();
					reject(new Error('Job failed ' + e));
				}
			});
		});
	}

	/**
  * Cleanup function to be called during startup,
  * resets jobs older than specified time
  * @param {String} name Queue name
  * @param {Number} olderThan Time in milliseconds
  * @returns {Boolean} Cleanup Done or not
  */
	static async cleanup(name, olderThan) {
		if (olderThan === undefined) return false;
		const n = await new Promise((resolve, reject) => Queue.jobs.activeCount(name, (err, total) => {
			if (err) reject(new Error('Could not get total active jobs'));
			resolve(total);
		}));
		return new Promise((resolve, reject) => {
			_kue2.default.job.rangeByType(name, 'active', 0, n, 'asc', (err, jobs) => {
				if (err) reject(new Error('Could not fetch jobs: ' + err));
				for (let i = 0; i < jobs.length; i++) {
					if (Date.now() - jobs[i].created_at > olderThan) {
						jobs[i].inactive();
					} else break;
				}
				resolve(true);
			});
		});
	}
}

exports.default = Queue;