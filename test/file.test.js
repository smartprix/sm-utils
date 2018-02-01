/* global before, after, describe, it */
import fs from 'fs';
import {promisify} from 'util';
import {expect} from 'chai';
import {File} from '../src/index';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

describe('file class', () => {
	let file;
	let nonExistentFile;
	let directory;
	const filePath = `${__dirname}/temp.txt`;
	const anotherFilePath = `${__dirname}/temp_abc.txt`;
	const dirPath = `${__dirname}/tempDir`;

	before(async () => {
		try {
			await writeFile(filePath, 'Hello..', {mode: 0o777});
			await mkdir(dirPath);
		}
		catch (e) {
			if (e.code !== 'EEXIST') {
				throw new Error(e);
			}
		}

		file = new File(filePath);
		nonExistentFile = new File(anotherFilePath);
		directory = new File(dirPath);
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

		it('should give correct existence output for a non existent file', async () => {
			const existenceOfNonExistentFile = await nonExistentFile.exists();
			expect(existenceOfNonExistentFile).to.be.false;
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

		it('should create the directory correctly', async () => {
			const existence = await directory.exists();
			const isFile = await directory.isFile();
			const isDir = await directory.isDir();
			const stats = await directory.lstat();

			expect(existence).to.equal(true);
			expect(isFile).to.equal(false);
			expect(isDir).to.equal(true);
			expect(stats).to.be.an('object');
			expect(stats).to.have.any.keys('dev', 'ino', 'mode', 'nlink', 'uid',
				'gid', 'rdev', 'size', 'blksize', 'blocks', 'atimeMs', 'mtimeMs',
				'ctimeMs', 'birthtimeMs', 'atime', 'mtime', 'ctime', 'birthtime');
		});

		it('should remove the directory correctly', async () => {
			await directory.rmdir();
			const existence = await directory.exists();
			expect(existence).to.be.false;
		});
	});

	after(async () => {
		await fs.unlink(filePath, (err) => {
			if (err) throw err;
		});
	});
});
