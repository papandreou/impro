var requireOr = require('require-or');
var Stream = require('stream');
var gm = requireOr('gm');
var mime = require('mime');
var errors = require('../errors');
var _ = require('lodash');

function getMockFileNameForContentType(contentType) {
    if (contentType) {
        return mime.extensions[contentType];
    }
}

module.exports = {
    name: 'gm',
    unavailable: !gm,
    operations: ['gif', 'png', 'jpeg', 'extract'].concat(Object.keys(gm.prototype).filter(function (propertyName) {
        return (!/^_|^(?:name|emit|.*Listeners?|on|once|size|orientation|format|depth|color|res|filesize|identity|write|stream)$/.test(propertyName) &&
            typeof gm.prototype[propertyName] === 'function');
    })),
    inputTypes: [ 'gif', 'jpeg', 'png', 'ico', '*' ],
    outputTypes: [ 'gif', 'jpeg', 'png', 'ico' ],
    execute: function (pipeline, operations) {
        // For some reason the gm module doesn't expose itself as a readable/writable stream,
        // so we need to wrap it into one:

        var readStream = new Stream();
        readStream.readable = true;

        var readWriteStream = new Stream();
        readWriteStream.readable = readWriteStream.writable = true;
        var spawned = false;
        readWriteStream.write = function (chunk) {
            if (!spawned) {
                spawned = true;
                var seenData = false,
                    hasEnded = false,
                    gmInstance = gm(readStream, getMockFileNameForContentType(operations[0].sourceContentType));
                if (pipeline.impro.maxInputPixels) {
                    gmInstance.limit('pixels', pipeline.impro.maxInputPixels);
                }
                var resize;
                var crop;
                var withoutEnlargement;
                var ignoreAspectRatio;
                for (var i = 0 ; i < operations.length ; i += 1) {
                    var operation = operations[i];
                    if (operation.name === 'resize') {
                        resize = operation;
                    } else if (operation.name === 'crop') {
                        crop = operation;
                    } else if (operation.name === 'withoutEnlargement') {
                        withoutEnlargement = operation;
                    } else if (operation.name === 'ignoreAspectRatio') {
                        ignoreAspectRatio = operation;
                    }
                }
                if (withoutEnlargement && resize) {
                    resize.args[1] += '>';
                }
                if (ignoreAspectRatio && resize) {
                    resize.args[1] += '!';
                }
                if (resize && crop) {
                    operations.push({
                        name: 'extent',
                        args: [].concat(resize.args)
                    });
                    resize.args.push('^');
                }
                operations.reduce(function (gmInstance, operation) {
                    var args = operation.args;
                    if (operation.name === 'resize' && typeof pipeline.impro.maxOutputPixels === 'number' && args[0] * args[1] > pipeline.impro.maxOutputPixels) {
                        throw new errors.OutputDimensionsExceeded('resize: Target dimensions of ' + args[0] + 'x' + args[1] + ' exceed maxOutputPixels (' + pipeline.impro.maxOutputPixels + ')');
                    }
                    if (operation.name === 'rotate' && operation.args.length === 1) {
                        operation = _.extend({}, operation);
                        operation.args = ['transparent', operation.args[0]];
                    }
                    if (operation.name === 'extract') {
                        operation.name = 'crop';
                        operation.args = [operation.args[2], operation.args[3], operation.args[0], operation.args[1]];
                    } else if (operation.name === 'crop') {
                        operation.name = 'gravity';
                        operation.args = [
                            {
                                northwest: 'NorthWest',
                                north: 'North',
                                northeast: 'NorthEast',
                                west: 'West',
                                center: 'Center',
                                east: 'East',
                                southwest: 'SouthWest',
                                south: 'South',
                                southeast: 'SouthEast'
                            }[String(operation.args[0]).toLowerCase()] || 'Center'
                        ];
                    }
                    if (operation.name === 'progressive') {
                        operation.name = 'interlace';
                        operation.args = [ 'line' ];
                    }
                    // There are many, many more that could be supported:
                    if (operation.name === 'webp' || operation.name === 'png' || operation.name === 'jpeg' || operation.name === 'gif') {
                        operation = _.extend({}, operation);
                        operation.args.unshift(operation.name);
                        operation.name = 'setFormat';
                    }
                    if (typeof gmInstance[operation.name] === 'function') {
                        return gmInstance[operation.name].apply(gmInstance, operation.args);
                    } else {
                        return gmInstance;
                    }
                }, gmInstance).stream(function (err, stdout, stderr) {
                    if (err) {
                        hasEnded = true;
                        return readWriteStream.emit('error', err);
                    }
                    stdout.on('data', function (chunk) {
                        seenData = true;
                        readWriteStream.emit('data', chunk);
                    }).on('end', function () {
                        if (!hasEnded) {
                            if (seenData) {
                                readWriteStream.emit('end');
                            } else {
                                readWriteStream.emit('error', new Error('The gm stream ended without emitting any data'));
                            }
                            hasEnded = true;
                        }
                    });
                });
            }
            readStream.emit('data', chunk);
        };
        readWriteStream.end = function (chunk) {
            if (chunk) {
                readWriteStream.write(chunk);
            }
            readStream.emit('end');
        };
        pipeline.add(readWriteStream);
    }
};
