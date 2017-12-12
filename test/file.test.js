import fs from 'fs';
import {expect} from 'chai';
import {File} from '../src/index';

describe('file class', () => {
	let file;
	const filePath = `${__dirname}/temp.txt`;

	before(async () => {
		await fs.writeFile(filePath, 'Hello..', {mode: 0o777}, (err) => {
			if (err) throw err;
		});
		file = new File(filePath);
	});

	describe('test file class functions', async () => {
		it('should create the file correctly', async () => {
			const existence = await file.exists();
			const isFile = await file.isFile();
			const isDir = await file.isDir();
			const stats = await file.lstat();

			expect(existence).to.equal(true);
			expect(isFile).to.equal(true);
			expect(isDir).to.equal(false);
			expect(stats).to.be.an('object');
			expect(stats).to.have.any.keys('dev', 'ino', 'mode', 'nlink', 'uid',
				'gid', 'rdev', 'size', 'blksize', 'blocks', 'atimeMs', 'mtimeMs',
				'ctimeMs', 'birthtimeMs', 'atime', 'mtime', 'ctime', 'birthtime');
		});

		it('should rename or move the file correctly', async () => {
			await file.rename(`${__dirname}/abc.txt`);
			const currentFilePath = await file.realpath();
			expect(currentFilePath).to.equal(`${__dirname}/abc.txt`);

			// to revert the name to the original one
			await file.rename(filePath);
		});

		it('should read, write and append to the file correctly', async () => {
			await file.write('Testing 123...');
			let contents = await file.read();
			expect(contents).to.equal('Testing 123...');

			await file.append('Testing Again!!');
			contents = await file.read();
			expect(contents).to.equal('Testing 123...Testing Again!!');
		});
	});

	after(async () => {
		await fs.unlink(filePath, (err) => {
			if (err) throw err;
		});
	});
});
