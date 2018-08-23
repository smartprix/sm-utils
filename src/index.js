/* eslint-disable global-require */
import File from './File';
import Crypt from './Crypt';
import Connect from './Connect';
import Cache from './Cache';
import Queue from './Queue';
import RedisCache from './RedisCache';
import System from './System';
import Lock from './Lock';
import Str from './Str';
import cfg from './cfg';
import Vachan from './Vachan';
import DeQueue from './DeQueue';
import Require from './Require';

module.exports = {
	file: File,
	system: System,
	crypt: Crypt,
	cfg,
	baseConvert: Crypt.baseConvert,
	File,
	Crypt,
	Connect,
	Cache,
	Queue,
	RedisCache,
	System,
	Lock,
	Str,
	Vachan,
	DeQueue,
	Require,
};
