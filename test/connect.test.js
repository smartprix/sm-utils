import fs from 'fs';
import {expect} from 'chai';
import {Connect, File} from '../src/index';

const responsePath = `${__dirname}/response.html`;

async function makeApiCall() {
	const connect = Connect.url('https://www.lipsum.com/feed/html');
	connect.userAgent('mobile');
	const options = {
		amount: 1,
		what: 'paras',
		start: 'yes',
		generate: 'Generate Lorem Ipsum',
	};
	connect.fields(options);
	connect.save(responsePath);

	return connect.get();
}

describe('connect class', () => {
	let response;
	before(async function () {
		this.timeout(10000);
		response = await makeApiCall();
	});

	describe('test connect class functions', async () => {
		it('should correctly fetch the response', () => {
			expect(response.statusCode).to.equal(200);
			expect(response.body).to.match(/Lorem ipsum dolor sit amet/);
		});

		it('should correctly save the response', async () => {
			const body = await (new File(responsePath)).read();
			expect(body).to.equal(response.body.toString());
		});
	});

	after(async () => {
		await fs.unlink(responsePath, (err) => {
			if (err) throw err;
		});
	});
});
