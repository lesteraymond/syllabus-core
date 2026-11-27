'use strict';
// Where the server keeps files on disk. The one place that reads UPLOAD_DIR and PRIVATE_DIR, so whatever writes a file and whatever reads it back agree.
// A relative value is a folder under server/; an absolute one (a persistent volume, for example /data/private) is used as it is.
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');
// Read when called, so a test (or a script) can point them somewhere else.
const uploadRoot = () => path.resolve(SERVER_DIR, process.env.UPLOAD_DIR || 'uploads'); // syllabus files
const privateRoot = () => path.resolve(SERVER_DIR, process.env.PRIVATE_DIR || 'private'); // profile photos and COR photos

module.exports = { uploadRoot, privateRoot };
