import fs from 'fs';
import {expect} from 'chai';
import {Connect, File} from '../src/index';

describe('@connect class', () => {
	before(async function () {
		this.timeout(10000);
	});

	it('should correctly fetch the response', async () => {
		const response = await Connect.url('https://www.smartprix.com/ip');

		expect(response.statusCode).to.equal(200);
		expect(response.body).to.match(/^\d{0,3}.\d{0,3}.\d{0,3}.\d{0,3}$/);
	});

	it('should correctly save the response', async () => {
		const responsePath = `${__dirname}/response.html`;
		const response = await Connect.url('https://www.smartprix.com/ip')
			.userAgent('mobile')
			.save(responsePath);

		const body = await File(responsePath).read();
		expect(body).to.match(/^\d{0,3}.\d{0,3}.\d{0,3}.\d{0,3}$/);
		expect(body).to.equal(response.body.toString());

		await fs.unlink(responsePath, (err) => {
			if (err) throw err;
		});
	});
});
