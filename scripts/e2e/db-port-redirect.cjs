'use strict';
// TEST-ONLY preload. With E2E_DB_PORT set, every loopback TCP connection to the default MySQL/MariaDB port 3306 made by THIS process is sent to E2E_DB_PORT instead,
// so the E2E stack can run against an isolated database server without any change to the application (which has no DB_PORT setting) and without touching the shared
// server on 3306. Only the port changes: the host stays a loopback address, and nothing else is rewritten.
//   node -r scripts/e2e/db-port-redirect.cjs ...      (scripts/e2e/offline-provider.cjs and db-bootstrap-check.cjs load it when E2E_DB_PORT is set)
// Fail closed: a port that is not a plain unprivileged number, or 3306 itself, disables nothing silently: the process refuses to start.
const net = require('node:net');
const raw = process.env.E2E_DB_PORT;
if (raw !== undefined && raw !== '') {
  const target = Number(raw);
  if (!Number.isInteger(target) || target < 1024 || target > 65535 || target === 3306) throw new Error('db-port-redirect: E2E_DB_PORT must be an unprivileged port other than 3306, got "' + raw + '"');
  const LOOPBACK = /^(localhost|127\.0\.0\.1|::1)$/i;
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function redirected(...args) {
    const first = args[0];
    // net.connect() hands Socket#connect its arguments already normalized: an array whose first element is the options object
    if (Array.isArray(first) && first[0] && typeof first[0] === 'object' && Number(first[0].port) === 3306 && LOOPBACK.test(String(first[0].host || 'localhost'))) first[0] = { ...first[0], port: target };
    else if (first && typeof first === 'object' && !Array.isArray(first) && Number(first.port) === 3306 && LOOPBACK.test(String(first.host || 'localhost'))) args[0] = { ...first, port: target };
    else if (typeof first === 'number' && first === 3306 && (args[1] === undefined || (typeof args[1] === 'string' && LOOPBACK.test(args[1])))) args[0] = target;
    return connect.apply(this, args);
  };
  module.exports = { target };
}
