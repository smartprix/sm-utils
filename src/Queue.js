import kue from 'kue';
import _ from 'lodash';

async function processorWrapper(job, processor, resolve, reject) {
	let res;
	try {
		job.active();
		job.attempt(() => {});
		res = await processor(job.data.input);
	}
	catch (e) {
		job.error(e);
		if (job.data.options.noFailure) {
			res = e;
		}
		else {
			job.failed();
			reject(new Error('Job failed ' + e));
			return;
		}
	}
	job.complete();
	job.set('result', res);
	const jobDetails = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
	resolve(jobDetails);
}

class Queue {
	static jobs;

	/**
	 * Class constructor : Create a new Queue
	 * @param {String} name Name of the queue
	 * @param {Object} [redis={port: 6379, host: '127.0.0.1'}] Redist connection settings object
	 */
	constructor(name, redis = {port: 6379, host: '127.0.0.1'}) {
		this.name = name;

		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			Queue.jobs.on('error', (err) => {
				console.log('Queue error: ', err.message);
			});
			process.once('SIGTERM', async () => {
				await Queue.exit();
				process.exit(0);
			});
		}
	}

	/**
	 * Add a job to the Queue
	 * @param {*} input Job data
	 * @param {Number|String} priority Priority of the job
	 * @returns {Number} The ID of the job created
	 */
	async addJob(input, priority = 0) {
		return new Promise((resolve, reject) => {
			const options = {
				noFailure: this.noFailure,
			};
			const job = Queue.jobs
				.create(this.name, {input, options})
				.priority(priority);

			// default = 1
			if (this.attempts) {
				job.attempts(this.attempts);
			}
			// default = 0
			if (this.delay) {
				job.delay(this.delay).backoff(true);
			}
			// default = 0, i.e. infinite
			if (this.ttl > 0) {
				job.ttl(this.ttl);
			}
			// default = false
			if (this.removeOnComplete) {
				job.removeOnComplete(true);
			}

			job.save((err) => {
				if (err) reject(new Error(err));
				resolve(job.id);
			});
		});
	}

	/**
	 * Set number of retry attempts for any job added after this is called
	 * @param {Number} attempts Number of attempts (>= 0), default = 1
	 */
	setAttempts(attempts) {
		this.attempts = attempts;
	}

	/**
	 * Set delay b/w successive jobs
	 * @param {Number} delay Delay b/w jobs, milliseconds, default = 0
	 */
	setDelay(delay) {
		this.delay = delay;
	}

	/**
	 * Set TTL (time to live) for new jobs added from now on,
	 * will fail job if not completed in TTL time
	 * @param {Number} ttl Time in milliseconds, infinite when 0. default = 0
	 */
	setTTL(ttl) {
		this.ttl = ttl;
	}

	/**
	 * Sets removeOnComplete for any job added to this Queue from now on
	 * @param {Boolean} removeOnComplete default = false
	 */
	setRemoveOnCompletion(removeOnComplete) {
		this.removeOnComplete = removeOnComplete;
	}

	/**
	 * Sets noFailure for any job added to this Queue from now on.
	 * This will mark the job complete even if it fails when true
	 * @param {Boolean} noFailure default = false
	 */
	setNoFailure(noFailure) {
		this.noFailure = noFailure;
	}

	/**
	 * An async function which will be called to process the job data
	 * @callback Queue~processorCallback
	 * @param {*} jobData The information saved in the job during adding of job
	 * @param {Object} [ctx] Can be used to pause and resume queue,
	 * 	Will only be passed when attaching a processor to the queue
	 * 		Usage:
	 * 		ctx.pause(timeout, callback()) :
	 * 			Waits for any active jobs to complete till timeout,
	 * 			then forcefully shuts them down (like shutdown)
	 * 		ctx.resume() : Resumes Queue processing
	 * 		For detailed info : https://github.com/Automattic/kue#pause-processing
	 * @returns {*} Must return something, will be saved/returned
	 */

	/**
	 * Attach a processor to the Queue which will keep getting jobs as it completes them
	 * @param {Queue~processorCallback} processor
	 * @param {Number} [concurrency=1] The number of jobs this processor can handle parallely
	 */
	addProcessor(processor, concurrency = 1) {
		Queue.jobs.process(this.name, concurrency, async (job, ctx, done) => {
			job.log('Start processing');
			let res;
			try {
				res = await processor(job.data.input, ctx);
			}
			catch (e) {
				if (job.data.options.noFailure) {
					done(null, e);
				}
				else {
					done(new Error(this.name + ' Job failed: ' + e.message));
				}
			}
			done(null, res);
		});
	}

	/**
	 * Internal data object
	 * @typedef {Object} internalData
	 * @property {*} input Input data given to job
	 * @property {Object} options Internal options used to set noFailure and extra properties
	 */

	/**
	 * Job status object.
	 * @typedef {Object} jobDetails
	 * @property {Number} id
	 * @property {String} type Name of the Queue
	 * @property {internalData} data Internal data object, includes input and options
	 * @property {*} result Result of the processor callback
	 * @property {String} state One of {'inactive', 'delayed' ,'active', 'complete', 'failed'}
	 * @property {*} error
	 * @property {Number} created_at unix time stamp
	 * @property {Number} updated_at unix time stamp
	 * @property {Object} attempts Attempts Object
	 */

	/**
	 * Process a single job in the Queue and mark it complete or failed,
	 * for when you want to manually process jobs
	 * @param {Queue~processorCallback} processor Called without ctx
	 * @returns {jobDetails} Job object of completed job
	 */
	async processJob(processor) {
		return new Promise((resolve, reject) => {
			kue.Job.rangeByType(this.name, 'inactive', 0, 1, 'asc', async (err, jobs) => {
				if (jobs.length === 0 || err) {
					reject(new Error('Queue empty ' + err));
				}
				const job = jobs[0];
				await processorWrapper(job, processor, resolve, reject);
			});
		});
	}

	/**
	 * Function to query the status of a job
	 * @param {Number} jobId Job id for which status info is required
	 * @returns {jobDetails} Object full of job details like state, time, attempts, etc.
	 */
	static async status(jobId) {
		return new Promise((resolve, reject) => {
			kue.Job.get(jobId, (err, job) => {
				if (err || !job) reject(new Error('Job not found ' + err));
				job = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
				resolve(job);
			});
		});
	}

	/**
	 * Manualy process a specific Job
	 * @param {Number} jobId Id of the job to be processed
	 * @param {Queue~processorCallback} processor Called without ctx
	 * @returns {jobDetails} Result of processor function and job object of completed job
	 */
	static async processJobById(jobId, processor) {
		return new Promise((resolve, reject) => {
			kue.Job.get(jobId, async (err, job) => {
				if (err) reject(new Error('Could not fetch job' + err));
				await processorWrapper(job, processor, resolve, reject);
			});
		});
	}

	/**
	 * Function shuts down the Queue gracefully.
	 * Waits for active jobs to complete until timeout, then marks them failed.
	 * @param {Number} [timeout=5000] Time in milliseconds, default = 5000
	 * @returns {Boolean}
	 */
	static async exit(timeout = 5000) {
		return new Promise((resolve) => {
			if (Queue.jobs === undefined) {
				resolve(true);
				return;
			}
			Queue.jobs.shutdown(timeout, (err) => {
				console.log('Sm-utils Queue shutdown: ', err || '');
				resolve(true);
			});
		});
	}

	/**
	 * Cleanup function to be called during startup,
	 * resets active jobs older than specified time
	 * @param {String} name Queue name
	 * @param {Number} [olderThan=5000] Time in milliseconds, default = 5000
	 */
	static async cleanup(name, olderThan = 5000) {
		if (Queue.jobs === undefined) throw new Error('Queue not initialized');
		const n = await new Promise((resolve, reject) => Queue.jobs.activeCount(name, (err, total) => {
			if (err) reject(new Error('Could not get total active jobs: ' + err));
			else resolve(total);
		}));
		return new Promise((resolve, reject) => {
			kue.job.rangeByType(name, 'active', 0, n, 'asc', (err, jobs) => {
				if (err) {
					reject(new Error('Could not fetch jobs: ' + err));
					return;
				}
				for (let i = 0; i < jobs.length; i++) {
					if (Date.now() - jobs[i].created_at > olderThan) { jobs[i].inactive() }
					else break;
				}
				resolve();
			});
		});
	}
}

export default Queue;
