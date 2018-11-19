import {expect} from 'chai';
import {System, Vachan} from '../src/index';

describe('system functions', () => {
	it('should execute commands correctly', async () => {
		let pwdResult = await System.execOut('type pwd');
		let echoResult = await System.execOut('type echo');

		pwdResult = pwdResult.trim();
		expect(pwdResult).to.equal('pwd is a shell builtin');

		echoResult = echoResult.trim();
		expect(echoResult).to.equal('echo is a shell builtin');
	});

	it('should modify filecreation mask correctly', () => {
		const prevUmask = System.noUmask();
		expect(prevUmask).to.not.equal(process.umask());

		System.yesUmask();
		expect(prevUmask).to.equal(process.umask());
	});

	it('should get user info correctly', async () => {
		const uid = System.getuid();
		expect(uid).to.be.a('number');

		const userInfo = await System.getUserInfo(uid);
		expect(userInfo).to.be.an('object');
		expect(userInfo).to.have.keys('username', 'password', 'uid', 'gid', 'comments', 'home', 'shell');

		const allUsers = await System.getAllUsers();
		expect(allUsers).to.be.an('object');
		expect(allUsers).to.have.any.keys('root');
	});

	it('should return consistent times', () => {
		const time = System.time();
		const millitime = System.millitime();
		const microtime = System.microtime();
		const nanotime = System.nanotime();

		expect(time).to.be.a('number');
		expect(Math.round(millitime)).to.be.closeTo(time, 1);
		expect(Math.round(microtime)).to.be.closeTo(time, 1);
		expect(Math.round(nanotime)).to.be.closeTo(time, 1);
	});

	describe('test onExit handler', function () {
		this.timeout(10000);
		let errorTest = '';
		let test1 = 1;
		let test2 = 2;
		let exited = false;
		const orginalExit = System._globalData.processExit;
		const originalError = console.error;

		before(() => {
			System._globalData.processExit = () => { exited = true };
			console.error = (err) => {
				errorTest += err.message;
			};
		});

		it('should add all exit handlers and not process them before exit', () => {
			System.onExit(() => { test1 = 'done' });
			System.onExit(async () => {
				await Vachan.sleep(2000);
				test2 = 'done';
			});
			System.onExit(async () => {
				throw new Error('error thrown');
			});
			expect(test1).to.equal(1);
			expect(test2).to.equal(2);
			expect(errorTest).to.equal('');
		});

		it('should exit process only after processing promises', async () => {
			process.kill(process.pid, 'SIGTERM');
			expect(exited).to.equal(false);
			await Vachan.sleep(2500);
			expect(exited).to.equal(true);
		});

		it('should have processed callbacks', () => {
			expect(test1).to.equal('done');
		});

		it('should have processed promises', () => {
			expect(test2).to.equal('done');
		});

		it('should catch error and still exit', () => {
			expect(errorTest).to.equal('error thrown');
		});

		after(() => {
			process.exit = orginalExit;
			console.error = originalError;
		});
	});
});
