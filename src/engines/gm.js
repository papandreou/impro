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

function isNumberWithin(num, min, max) {
    return typeof num === 'number' && num >= min && num <= max;
}

var maxDimension = 16384;

module.exports = {
    name: 'gm',
    unavailable: !gm,
    operations: ['gif', 'png', 'jpeg', 'extract'].concat(
        Object.keys(gm.prototype).filter(function(propertyName) {
            return (
                !/^_|^(?:name|emit|.*Listeners?|on|once|size|orientation|format|depth|color|res|filesize|identity|write|stream|type|setmoc)$/.test(
                    propertyName
                ) && typeof gm.prototype[propertyName] === 'function'
            );
        })
    ),
    inputTypes: ['gif', 'jpeg', 'png', 'ico', 'tga', 'tiff', '*'],
    outputTypes: ['gif', 'jpeg', 'png', 'ico', 'tga', 'tiff'],
    validateOperation: function(name, args) {
        switch (name) {
            // Operations that emulate sharp's API:
            case 'withoutEnlargement':
            case 'ignoreAspectRatio':
            case 'progressive':
                return args.length === 0;
            case 'crop':
                return (
                    args.length === 1 &&
                    /^(?:east|west|center|north(?:|west|east)|south(?:|west|east))/.test(
                        args[0]
                    )
                );
            case 'rotate':
                return (
                    args.length === 0 ||
                    (args.length === 1 &&
                        (args[0] === 0 ||
                            args[0] === 90 ||
                            args[0] === 180 ||
                            args[0] === 270))
                );
            case 'resize':
                return (
                    args.length === 2 &&
                    isNumberWithin(args[0], 1, maxDimension) &&
                    isNumberWithin(args[1], 1, maxDimension)
                );
            case 'extract':
                return (
                    args.length === 4 &&
                    isNumberWithin(args[0], 0, maxDimension - 1) &&
                    isNumberWithin(args[1], 0, maxDimension - 1) &&
                    isNumberWithin(args[2], 1, maxDimension) &&
                    isNumberWithin(args[3], 1, maxDimension)
                );
            case 'quality':
                return args.length === 1 && isNumberWithin(args[0], 1, 100);
        }
    },
    execute: function(pipeline, operations) {
        // For some reason the gm module doesn't expose itself as a readable/writable stream,
        // so we need to wrap it into one:

        var readStream = new Stream();
        readStream.readable = true;

        var readWriteStream = new Stream();
        readWriteStream.readable = readWriteStream.writable = true;
        var spawned = false;
        readWriteStream.write = function(chunk) {
            if (!spawned) {
                spawned = true;
                var seenData = false;
                var hasEnded = false;
                var gmInstance = gm(
                    readStream,
                    getMockFileNameForContentType(
                        operations[0].sourceContentType
                    )
                );
                if (pipeline.options.maxInputPixels) {
                    gmInstance.limit('pixels', pipeline.options.maxInputPixels);
                }
                var resize;
                var crop;
                var withoutEnlargement;
                var ignoreAspectRatio;
                for (var i = 0; i < operations.length; i += 1) {
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

                operations
                    .reduce(function(gmInstance, operation) {
                        var args = operation.args;

                        if (
                            operation.name === 'resize' &&
                            typeof pipeline.options.maxOutputPixels ===
                                'number' &&
                            args[0] * args[1] > pipeline.options.maxOutputPixels
                        ) {
                            throw new errors.OutputDimensionsExceeded(
                                'resize: Target dimensions of ' +
                                    args[0] +
                                    'x' +
                                    args[1] +
                                    ' exceed maxOutputPixels (' +
                                    pipeline.options.maxOutputPixels +
                                    ')'
                            );
                        }
                        if (
                            operation.name === 'rotate' &&
                            operation.args.length === 1
                        ) {
                            operation = _.extend({}, operation);
                            operation.args = ['transparent', operation.args[0]];
                        }
                        if (operation.name === 'extract') {
                            operation.name = 'crop';
                            operation.args = [
                                operation.args[2],
                                operation.args[3],
                                operation.args[0],
                                operation.args[1]
                            ];
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
                                }[String(operation.args[0]).toLowerCase()] ||
                                    'Center'
                            ];
                        }
                        if (operation.name === 'progressive') {
                            operation.name = 'interlace';
                            operation.args = ['line'];
                        }
                        // There are many, many more that could be supported:
                        if (
                            operation.name === 'webp' ||
                            operation.name === 'png' ||
                            operation.name === 'jpeg' ||
                            operation.name === 'gif'
                        ) {
                            operation = _.extend({}, operation);
                            operation.args.unshift(operation.name);
                            operation.name = 'setFormat';
                        }
                        if (typeof gmInstance[operation.name] === 'function') {
                            return gmInstance[operation.name].apply(
                                gmInstance,
                                operation.args
                            );
                        } else {
                            return gmInstance;
                        }
                    }, gmInstance)
                    .stream(function(err, stdout, stderr) {
                        if (err) {
                            hasEnded = true;
                            return readWriteStream.emit('error', err);
                        }
                        stdout
                            .on('data', function(chunk) {
                                seenData = true;
                                readWriteStream.emit('data', chunk);
                            })
                            .on('end', function() {
                                if (!hasEnded) {
                                    if (seenData) {
                                        readWriteStream.emit('end');
                                    } else {
                                        readWriteStream.emit(
                                            'error',
                                            new Error(
                                                'The gm stream ended without emitting any data'
                                            )
                                        );
                                    }
                                    hasEnded = true;
                                }
                            });
                    });
            }
            readStream.emit('data', chunk);
        };
        readWriteStream.end = function(chunk) {
            if (chunk) {
                readWriteStream.write(chunk);
            }
            readStream.emit('end');
        };
        pipeline.add(readWriteStream);
    }
};
