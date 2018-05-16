import fs from 'fs';
import {expect} from 'chai';
import {Connect, File} from '../src/index';

describe('connect class', () => {
	before(async function () {
		this.timeout(10000);
	});

	it('should correctly fetch the response', async () => {
		const response = await Connect.url('https://www.lipsum.com/feed/html')
			.userAgent('mobile')
			.fields({
				amount: 1,
				what: 'paras',
				start: 'yes',
				generate: 'Generate Lorem Ipsum',
			});

		expect(response.statusCode).to.equal(200);
		expect(response.body).to.match(/Lorem ipsum dolor sit amet/);
	});

	it('should correctly save the response', async () => {
		const responsePath = `${__dirname}/response.html`;
		const response = await Connect.url('https://www.lipsum.com/feed/html')
			.userAgent('mobile')
			.fields({
				amount: 1,
				what: 'paras',
				start: 'yes',
				generate: 'Generate Lorem Ipsum',
			})
			.save(responsePath);

		const body = await File(responsePath).read();
		expect(body).to.match(/Lorem ipsum dolor sit amet/);
		expect(body).to.equal(response.body.toString());

		await fs.unlink(responsePath, (err) => {
			if (err) throw err;
		});
	});
});
