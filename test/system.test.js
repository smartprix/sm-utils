import {expect} from 'chai';
import {System} from '../src/index';

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

		const userInfo = await System.getUserInfo(uid)
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
});
