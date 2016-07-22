const sourceMapSupport = require('longjohn/node_modules/source-map-support');
const babelRegisterCache = require('babel-register/lib/cache');

sourceMapSupport._install = sourceMapSupport.install;
sourceMapSupport.install = function () {
	sourceMapSupport._install({
		overrideRetrieveSourceMap: true,
		retrieveSourceMap(file) {
			const cache = babelRegisterCache.get();
			let sourceMap = null;

			Object.keys(cache).some((hash) => {
				const fileCache = cache[hash];
				if (
					typeof fileCache === 'undefined' ||
					typeof fileCache.options === 'undefined' ||
					fileCache.options.filename !== file
				) {
					return false;
				}

				sourceMap = {
					url: file,
					map: fileCache.map,
				};

				return true;
			});

			return sourceMap;
		},
	});
};

// sourceMapSupport.install();

require('longjohn');

module.exports = {

};
