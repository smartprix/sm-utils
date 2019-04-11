import cfg from '@smpx/cfg';

import File from './File';
import Crypt from './Crypt';
import Connect from './Connect';
import Cache from './Cache';
import LRU from './LRU';
import Queue from './Queue';
import RedisCache from './RedisCache';
import System from './System';
import Lock from './Lock';
import Str from './Str';
import Vachan from './Vachan';
import DeQueue from './DeQueue';
import Require from './Require';

const file = File;

/** @type {Crypt} */
const crypt = Crypt;

/** @type {System} */
const system = System;

/** @type {Crypt.baseConvert} */
const baseConvert = Crypt.baseConvert;

// include some deprecated cfg items
cfg.is_production = cfg.isProduction;
cfg.is_prod = cfg.isProduction;
cfg.is_dev = cfg.isDev;
cfg.is_test = cfg.isTest;
cfg.is_staging = cfg.isStaging;

export {
	file,
	system,
	crypt,
	cfg,
	baseConvert,
	File,
	Crypt,
	Connect,
	Cache,
	LRU,
	Queue,
	RedisCache,
	System,
	Lock,
	Str,
	Vachan,
	DeQueue,
	Require,
};
