import kue from 'kue';
import _ from 'lodash';
import {EventEmitter} from 'events';
import {setTimeout} from 'timers';

async function processorWrapper(job, processor, resolve, reject) {
	let res;
	try {
		if (job.state() === 'active') {
			reject(new Error('Job already processing'));
			return;
		}
		job.active();
		job.attempt(() => {});
		res = await processor(job.data.input);
	}
	catch (e) {
		job.error(e.message);
		job._error = e.message;
		if (!job.data.options.noFailure) {
			job.failed();
			reject(new Error('Job failed ' + e));
			return;
		}
	}
	if (!_.isNil(res)) {
		job.result = res;
		job.set('result', JSON.stringify(res));
	}
	job.complete();

	const jobDetails = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
	jobDetails.attempts.made++;
	jobDetails.attempts.remaining--;
	resolve(jobDetails);
}

class Queue {
	static jobs;
	static events = new EventEmitter();

	/**
	 * Class constructor : Create a new Queue
	 * The redis and enableWatchdog settings are required only the first time to init
	 * @param {String} name Name of the queue
	 * @param {Object} [redis={port: 6379, host: '127.0.0.1'}] Redist connection settings object
	 * @param {Boolean} [enableWatchdog=false] Will watch for stuck jobs due to any connection issues
	 * 		Read more here :  https://github.com/Automattic/kue#unstable-redis-connections
	 */
	constructor(name, redis = {port: 6379, host: '127.0.0.1'}, enableWatchdog = false) {
		this.name = name;

		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			if (enableWatchdog)	Queue.jobs.watchStuckJobs(10000);
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
	 * @callback processorCallback
	 * @param {*} jobData The information saved in the job during adding of job
	 * @returns {*} Will be saved in return field in JobDetails
	 */

	/**
	 * Attach a processor to the Queue which will keep getting jobs as it completes them
	 * @param {processorCallback} processor Function to be called to process the job data
	 * @param {Number} [concurrency=1] The number of jobs this processor can handle parallely
	 */
	addProcessor(processor, concurrency = 1) {
		// Increase max event listeners limit
		Queue.jobs.setMaxListeners(Queue.jobs.getMaxListeners() + concurrency);

		Queue.jobs.process(this.name, concurrency, async (job, ctx, done) => {
			Queue.events.setMaxListeners(Queue.events.getMaxListeners() + 2);

			Queue.events.on(`${this.name}:pause`, (timeout, res, rej) => {
				// ctx Can be used to pause and resume worker,
				// For detailed info : https://github.com/Automattic/kue#pause-processing
				ctx.pause(timeout, (err) => {
					if (err) rej();
					else res();
				});
			});

			Queue.events.on(`${this.name}:resume`, () => {
				ctx.resume();
			});

			job.log('Start processing');
			let res;
			try {
				res = await processor(job.data.input, ctx);
			}
			catch (e) {
				if (job.data.options.noFailure) {
					job.error(e);
				}
				else {
					done(new Error(this.name + ' Job failed: ' + e.message));
					return;
				}
			}
			done(null, res);
		});
	}

	/**
	 * Pause Queue processing
	 * Gives timeout time to all workers to complete their current jobs then stops them
	 * @param {Number} [timeout=5000] Time to complete current jobs in ms
	 */
	async pauseProcessor(timeout = 5000) {
		return new Promise((resolve, reject) => {
			Queue.events.emit(`${this.name}:pause`, timeout, resolve, reject);
		});
	}

	/**
	 * Resume Queue processing
	 */
	resumeProcessor() {
		Queue.events.emit(`${this.name}:resume`);
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
	 * @param {processorCallback} processor Function to be called to process the job data, without ctx
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
	 * Cleanup function to be called during startup,
	 * resets active jobs older than specified time
	 * @param {Number} [olderThan=5000] Time in milliseconds, default = 5000
	 */
	async cleanup(olderThan = 5000) {
		const n = await new Promise((resolve, reject) =>
			Queue.jobs.activeCount(this.name, (err, total) => {
				if (err) reject(new Error('Could not get total active jobs: ' + err));
				else resolve(total);
			}));
		return new Promise((resolve, reject) => {
			kue.Job.rangeByType(this.name, 'active', 0, n, 'asc', (err, jobs) => {
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

	/**
	 * Function to query the status of a job
	 * @param {Number} jobId Job id for which status info is required
	 * @returns {jobDetails} Object full of job details like state, time, attempts, etc.
	 */
	static async status(jobId) {
		return new Promise((resolve, reject) => {
			kue.Job.get(jobId, (err, job) => {
				if (err || !job) {
					reject(new Error('Job not found ' + err));
					return;
				}
				job = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
				resolve(job);
			});
		});
	}

	/**
	 * Manualy process a specific Job, ignores any attempts limit set
	 * @param {Number} jobId Id of the job to be processed
	 * @param {processorCallback} processor Function to be called to process the job data, without ctx
	 * @returns {jobDetails} Result of processor function and job object of completed job
	 */
	static async processJobById(jobId, processor) {
		return new Promise((resolve, reject) => {
			kue.Job.get(jobId, async (err, job) => {
				if (err || !job) {
					reject(new Error('Could not fetch job' + err));
					return;
				}
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

			// eslint-disable-next-line no-unused-vars
			Queue.jobs.shutdown(timeout, (err) => {
				resolve(true);
			});
		});
	}
}

export default Queue;
