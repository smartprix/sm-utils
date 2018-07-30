import kue from 'kue';
import _ from 'lodash';
import System from './System';

async function processorWrapper(job, processor, resolve, reject) {
	let res;
	let jobDetails;
	if (job.state() === 'active') {
		reject(new Error('Job already processing'));
		return;
	}
	else if (job.state() === 'inactive') {
		job.active();
		job.attempt(() => {});
		try {
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
		jobDetails = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
		jobDetails.attempts.made++;
		jobDetails.attempts.remaining--;
	}
	// Job is already complete/failed
	else {
		jobDetails = _.pick(job.toJSON(), ['id', 'type', 'data', 'result', 'state', 'error', 'created_at', 'updated_at', 'attempts']);
	}
	resolve(jobDetails);
}

async function iterateOverJobs(queue, jobType, numOfJobs, olderThan, action) {
	const now = Date.now();
	return new Promise((resolve, reject) => {
		kue.Job.rangeByType(queue, jobType, 0, numOfJobs, 'asc', async (err, jobs) => {
			if (err) {
				reject(new Error('Could not fetch jobs: ' + err));
				return;
			}
			for (let i = 0; i < jobs.length; i++) {
				if (now - jobs[i].created_at > olderThan) {
					jobs[i].log(`Doing ${action}`);
					jobs[i][action](() => {});
				}
				else break;
			}
			resolve();
		});
	});
}

class Queue {
	static jobs;
	static queues = {};

	/**
	 * Initialise the redis connection
	 * @param {Object} [redis={port: 6379, host: '127.0.0.1'}] Redist connection settings object
	 * @param {Boolean} [enableWatchdog=false] Will watch for stuck jobs due to any connection issues
	 * Read more here :  https://github.com/Automattic/kue#unstable-redis-connections
	 */
	static init(redis, enableWatchdog) {
		if (!Queue.jobs) {
			Queue.jobs = kue.createQueue({
				redis,
			});
			if (enableWatchdog)	Queue.jobs.watchStuckJobs(10000);
			Queue.jobs.on('error', (err) => {
				console.error(`[Queue] ${err}`);
			});
		}
	}

	/**
	 * Class constructor : Create a new Queue
	 * The redis and enableWatchdog settings are required only the first time to init
	 * Can also be set beforehand by calling Queue.init()
	 * @param {String} name Name of the queue
	 * @param {Object} [redis={port: 6379, host: '127.0.0.1'}] Redist connection settings object
	 * @param {Boolean} [enableWatchdog=false] Will watch for stuck jobs due to any connection issues
	 * 		Read more here :  https://github.com/Automattic/kue#unstable-redis-connections
	 */
	constructor(name, redis = {port: 6379, host: '127.0.0.1'}, enableWatchdog = false) {
		this.name = `${name}${process.env.NODE_ENV ? '-' + process.env.NODE_ENV : ''}`;
		if (!Queue.queues[this.name]) Queue.queues[this.name] = {processorAdded: false};
		this.paused = undefined;
		this.kueCtx = undefined;
		Queue.init(redis, enableWatchdog);
	}


	/**
	 * @typedef {Object} addOpts
	 * @property {Number|String} [opts.priority=0] Priority of the job, lower number is better
	 * Options are : low: 10, normal: 0, medium: -5, high: -10, critical: -15 | Or any integer
	 * @property {Number} [opts.attempts] Number of attempts
	 * @property {Number} [otps.delay] Delay in between jobs
	 * @property {Number} [opts.ttl] Time to live for job
	 * @property {Boolean} [opts.removeOnComplete] Remove job on completion
	 * @property {Boolean} [opts.noFailure] Mark job as complete even if it fails
	 */

	/**
	 * Add a job to the Queue
	 * @param {*} input Job data
	 * @param {addOpts} opts
	 * @returns {Number|*} The ID of the job created
	 */
	async addJob(input, {
		priority = 0,
		attempts = this.attempts,
		delay = this.delay,
		ttl = this.ttl,
		removeOnComplete = this.removeOnComplete,
		noFailure = this.noFailure ? true : undefined,
		_getResult = false,
		_timeout,
		_dummy,
	} = {}) {
		return new Promise((resolve, reject) => {
			let completed = false;
			const options = {
				noFailure,
				_dummy,
				_timeout,
			};
			const job = Queue.jobs
				.create(this.name, {input, options})
				.priority(priority);

			// default = 1
			if (attempts) {
				job.attempts(this.attempts);
			}
			// default = 0
			if (delay) {
				job.delay(this.delay).backoff(true);
			}
			// default = 0, i.e. infinite
			if (ttl > 0) {
				job.ttl(this.ttl);
			}
			// default = false
			if (removeOnComplete) {
				job.removeOnComplete(true);
			}

			if (_getResult) {
				job.on('complete', (res) => {
					completed = true;
					resolve(res);
				})
					.on('failed', (errMsg) => {
						if (!completed) {
							completed = true;
							reject(new Error(errMsg));
						}
					})
					.on('remove', () => {
						if (!completed) {
							completed = true;
							reject(new Error('Job Removed before completion'));
						}
					});
			}

			job.save((err) => {
				if (err) reject(new Error(err));
				else if (!_getResult) resolve(job.id);
				else if (!_.isNil(_timeout)) {
					setTimeout(() => {
						if (!completed) {
							completed = true;
							job.log('Error: Timed out');
							job.failed();
							reject(new Error('Timed out'));
						}
					}, _timeout);
				}
			});
		});
	}

	/**
	 * Add a job to the Queue, wait for it to process and return result
	 * Preferably set PRIORITY HIGH or it might timeout if lots of other tasks are in queue
	 * Queue will process job only if timeout is not passed when processing begins
	 * @param {*} input Job data
	 * @param {addOpts} opts
	 * @param {number} [timeout=180000] wait for this time else throw err
	 * @returns {*} result
	 */
	async addAndProcess(input, opts = {}, timeout = 180000) {
		opts._getResult = true;
		opts._timeout = timeout;
		return this.addJob(input, opts);
	}

	/**
	 * Set default number of retry attempts for any job added later
	 * @param {Number} attempts Number of attempts (>= 0), default = 1
	 */
	setAttempts(attempts) {
		this.attempts = attempts;
	}

	/**
	 * Set delay b/w successive jobs for any job added later
	 * @param {Number} delay Delay b/w jobs, milliseconds, default = 0
	 */
	setDelay(delay) {
		this.delay = delay;
	}

	/**
	 * Set default TTL (time to live) for new jobs added from now on,
	 * will fail job if not completed in TTL time
	 * @param {Number} ttl Time in milliseconds, infinite when 0. default = 0
	 */
	setTTL(ttl) {
		this.ttl = ttl;
	}

	/**
	 * Sets default removeOnComplete for any job added to this Queue from now on
	 * @param {Boolean} removeOnComplete default = false
	 */
	setRemoveOnCompletion(removeOnComplete) {
		this.removeOnComplete = removeOnComplete;
	}

	/**
	 * Sets default noFailure for any job added to this Queue from now on.
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
	async addProcessor(processor, concurrency = 1) {
		if (Queue.queues[this.name].processorAdded) {
			throw new Error(`Processor already added for queue ${this.name}, can only be set once per queue.`);
		}
		// Increase max event listeners limit
		Queue.jobs.setMaxListeners(Queue.jobs.getMaxListeners() + concurrency);

		// ctx Can be used to pause and resume worker,
		// For detailed info : https://github.com/Automattic/kue#pause-processing
		Queue.jobs.process(this.name, concurrency, async (job, ctx, done) => {
			if (!this.kueCtx) this.kueCtx = ctx;
			if (job.data.options._dummy) {
				done(null, true);
				return;
			}
			else if (job.data.options._timeout !== undefined &&
				(Date.now() - job.created_at) > job.data.options._timeout) {
				job.log(`Time passed: ${(Date.now() - job.created_at)}, Timeout: ${job.data.options._timeout}`);
				done(new Error('Timed out'));
				return;
			}
			job.log('Start processing');
			let res;
			try {
				res = await processor(job.data.input);
			}
			catch (e) {
				job.log('Errored: ' + e.message);
				if (job.data.options.noFailure) {
					job.error(e);
				}
				else {
					done(new Error(this.name + ' Job failed: ' + e.message));
					return;
				}
			}
			job.log('Done');
			done(null, res);
		});

		this.paused = false;
		Queue.queues[this.name].processorAdded = true;
		try {
			// We add this so that keuCtx gets set without having to wait for a job to be added
			await this.addAndProcess({}, {
				_dummy: true,
				priority: Number.MIN_SAFE_INTEGER,
				removeOnComplete: true,
			}, 10000);
		}
		catch (err) {
			console.error('[Queue] Could not set kue ctx');
		}
	}

	/**
	 * Pause Queue processing
	 * Gives timeout time to all workers to complete their current jobs then stops them
	 * @param {Number} [timeout=5000] Time to complete current jobs in ms
	 */
	async pauseProcessor(timeout = 5000) {
		if (!Queue.queues[this.name].processorAdded) throw new Error('No processor present');
		if (this.paused) return;
		await new Promise((resolve, reject) => {
			if (!this.kueCtx) {
				reject(new Error('Worker context not yet available, please add atleast one job before pausing/resuming'));
				return;
			}
			this.kueCtx.pause(timeout, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
		this.paused = true;
	}

	/**
	 * Resume Queue processing
	 */
	resumeProcessor() {
		if (!Queue.queues[this.name].processorAdded) throw new Error('No processor present');
		if (!this.paused) return;
		if (!this.kueCtx) {
			throw new Error('Worker context not yet available, please add atleast one job before pausing/resuming');
		}
		this.kueCtx.resume();
		this.paused = false;
	}

	/**
	 * Return count of jobs in Queue of JobType
	 * @param {String} queue Queue name
	 * @param {String} jobType One of {'inactive', 'delayed' ,'active', 'complete', 'failed'}
	 * @returns {Number} count
	 */
	static async getCount(queue, jobType) {
		return new Promise((resolve, reject) => {
			Queue.jobs[jobType + 'Count'](queue, (err, total) => {
				if (err) reject(new Error('Could not get total ' + jobType + ' jobs: ' + err));
				else resolve(total);
			});
		});
	}
	/**
	 * Return count of inactive jobs in Queue
	 * @returns {Number} inactiveCount
	 */
	async inactiveJobs() {
		return Queue.getCount(this.name, 'inactive');
	}

	/**
	 * Alias for inactiveJobs
	 */
	pendingJobs() {
		return this.inactiveJobs();
	}

	/**
	 * Return count of completed jobs in Queue
	 * Might return 0 if removeOnComplete was true
	 * @returns {Number} completeCount
	 */
	async completedJobs() {
		return Queue.getCount(this.name, 'complete');
	}

	/**
	 * Return count of failed jobs in Queue
	 * @returns {Number} failedCount
	 */
	async failedJobs() {
		return Queue.getCount(this.name, 'failed');
	}

	/**
	 * Return count of delayed jobs in Queue
	 * @returns {Number} delayedCount
	 */
	async delayedJobs() {
		return Queue.getCount(this.name, 'delayed');
	}

	/**
	 * Return count of active jobs in Queue
	 * @returns {Number} activeCount
	 */
	async activeJobs() {
		return Queue.getCount(this.name, 'active');
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
		const n = await Queue.getCount(this.name, 'active');
		return iterateOverJobs(this.name, 'active', n, olderThan, 'inactive');
	}

	/**
	 * Removes any old jobs from queue
	 * older than specified time
	 * @param {Number} [olderThan=3600000] Time in milliseconds, default = 3600000 (1 hr)
	 */
	async delete(olderThan = 3600000) {
		const completed = await this.completedJobs();
		const removeComplete = iterateOverJobs(this.name, 'complete', completed, olderThan, 'remove');

		const failed = await this.failedJobs();
		const removeFailed = iterateOverJobs(this.name, 'failed', failed, olderThan, 'remove');

		const inactive = await this.pendingJobs();
		const removeInactive = iterateOverJobs(this.name, 'inactive', inactive, olderThan, 'remove');

		const delayed = await this.delayedJobs();
		const removeDelayed = iterateOverJobs(this.name, 'delayed', delayed, olderThan, 'remove');

		const active = await this.activeJobs();
		const removeActive = iterateOverJobs(this.name, 'active', active, olderThan, 'remove');

		return Promise.all([removeComplete, removeFailed, removeInactive, removeDelayed, removeActive]);
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
	 * Manualy process a specific Job. Returns existing result if job already processed
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
	 * @param {Number} [timeout=10000] Time in milliseconds, default = 10000
	 * @returns {Boolean}
	 */
	static async exit(timeout = 10000) {
		return new Promise((resolve) => {
			if (Queue.jobs === undefined) {
				resolve(true);
			}
			else {
				console.log('[Queue] Shutting down redis queue');
				// eslint-disable-next-line no-unused-vars
				Queue.jobs.shutdown(timeout, (err) => {
					Queue.jobs = undefined;
					resolve(true);
				});
			}
		});
	}
}

System.onExit(Queue.exit);

export default Queue;
