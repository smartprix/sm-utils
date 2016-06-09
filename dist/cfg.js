'use strict';

var _ = require('lodash');

var config = {};

function cfg(key, default_value) {
    if (key in config) return config[key];

    return default_value;
}

cfg.get = function () {
    return cfg(key, default_value);
};

cfg.set = function (key, value) {
    if (value === undefined && key instanceof Object) {
        config = _.assign(config, key);
        return null;
    }

    var prev = config[key];
    config[key] = value;
    return prev;
};

module.exports = cfg;