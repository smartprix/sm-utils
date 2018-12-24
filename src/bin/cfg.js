#! /usr/bin/env node
import commander from 'commander';

import cfg from '../cfg';
import {version} from '../../package.json';

function handleUnknownCommands() {
	// no command passed
	if (process.argv.length <= 2) {
		commander.help();
		process.exit(1);
	}

	// error on unknown commands
	commander.on('command:*', () => {
		console.error('Invalid command: %s\nSee --help for a list of available commands.', commander.args.join(' '));
		process.exit(1);
	});
}

const description = [
	'get a value from config.js\n',
	'Examples:',
	'cfg get redis.port',
	'cfg get logsDir',
];

commander
	.version(version, '-v, --version')
	.command('get <key>')
	.description(description.join('\n'))
	.action((key) => {
		const value = cfg(key);
		if (value == null) {
			// write empty string in case of null and undefined
			process.stdout.write('');
		}
		else if (typeof value === 'object') {
			// stringify value in case of object
			process.stdout.write(JSON.stringify(value));
		}
		else {
			process.stdout.write(String(value));
		}
	});

handleUnknownCommands();
commander.parse(process.argv);
