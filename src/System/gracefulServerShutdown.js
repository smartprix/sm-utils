/**
 * gracefully shuts downs a http server
 * Partially based on: https://github.com/sebhildebrandt/http-graceful-shutdown
 * LICENSE: MIT
 */

const connections = new Map();
let isShuttingDown = false;
let connectionCounter = 0;

function destroy(socket) {
	if (socket._isIdle && isShuttingDown) {
		socket.destroy();
		connections.delete(socket._connectionId);
	}
}


function cleanup(server) {
	return new Promise((resolve, reject) => {
		connections.forEach((connection) => {
			destroy(connection);
		});

		// normal shutdown
		server.close((err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
}

function GracefulShutdown(server) {
	server.on('request', (req, res) => {
		req.socket._isIdle = false;

		res.on('finish', () => {
			req.socket._isIdle = true;
			destroy(req.socket);
		});
	});

	server.on('connection', (socket) => {
		const id = connectionCounter++;
		socket._isIdle = true;
		socket._connectionId = id;
		connections.set(id, socket);

		socket.on('close', () => {
			connections.delete(id);
		});
	});

	const shutdown = () => {
		isShuttingDown = true;
		cleanup(server);
	};

	return shutdown;
}

export default GracefulShutdown;
