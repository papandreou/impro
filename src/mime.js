const mime = require('mime');

module.exports.getExtension = (ext) => mime.getExtension(ext) || undefined;
module.exports.getType = (type) => mime.getType(type) || undefined;
