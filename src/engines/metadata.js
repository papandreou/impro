var requireOr = require('require-or');
var sharp = requireOr('sharp');
var Stream = require('stream');
var createAnimatedGifDetector = requireOr('animated-gif-detector');
var mime = require('mime');
var exifReader = require('exif-reader');
var icc = require('icc');
var _ = require('lodash');

module.exports = {
    name: 'metadata',
    unavailable: !sharp,
    inputTypes: [ '*' ],
    outputTypes: [ 'json' ],
    validateOperation: function (name, args) {
        return name === 'metadata' && args.length === 0 || (args.length === 1 && args[0] === true);
    },
    execute: function (pipeline, operations, options) {
        var sharpInstance = sharp();
        var duplexStream = new Stream.Duplex();
        var animatedGifDetector;
        var isAnimated;
        if ((pipeline.targetType === 'gif' || !pipeline.targetType) && createAnimatedGifDetector) {
            animatedGifDetector = createAnimatedGifDetector();
            animatedGifDetector.on('animated', function () {
                isAnimated = true;
                this.emit('decided');
                animatedGifDetector = null;
            });

            duplexStream.on('finish', function () {
                if (typeof isAnimated === 'undefined') {
                    isAnimated = false;
                    if (animatedGifDetector) {
                        animatedGifDetector.emit('decided', false);
                        animatedGifDetector = null;
                    }
                }
            });
        }
        duplexStream._write = function (chunk, encoding, cb) {
            if (animatedGifDetector) {
                animatedGifDetector.write(chunk);
            }
            if (sharpInstance.write(chunk, encoding) === false && !animatedGifDetector) {
                sharpInstance.once('drain', cb);
            } else {
                cb();
            }
        };
        var alreadyKnownMetadata = {
            format: pipeline.targetType,
            contentType: pipeline.targetContentType || mime.types[pipeline.targetType]
        };
        if (pipeline._streams.length === 0) {
            _.extend(alreadyKnownMetadata, pipeline.sourceMetadata);
        }
        duplexStream._read = function (size) {
            sharpInstance.metadata(function (err, metadata) {
                if (err) {
                    metadata = _.defaults({ error: err.message }, alreadyKnownMetadata);
                }
                if (metadata.format === 'magick') {
                    // https://github.com/lovell/sharp/issues/377
                    metadata.format = undefined;
                } else if (metadata.format) {
                    // metadata.format is one of 'jpeg', 'png', 'webp' so this should be safe:
                    metadata.contentType = 'image/' + metadata.format;
                }
                _.defaults(metadata, alreadyKnownMetadata);
                if (metadata.exif) {
                    var exifData;
                    try {
                        exifData = exifReader(metadata.exif);
                    } catch (e) {
                        // Error: Invalid EXIF
                    }
                    metadata.exif = undefined;
                    if (exifData) {
                        _.defaults(metadata, exifData);
                    }
                }
                if (metadata.icc) {
                    try {
                        metadata.icc = icc.parse(metadata.icc);
                    } catch (e) {
                        // Error: Error: Invalid ICC profile, remove the Buffer
                        metadata.icc = undefined;
                    }
                }
                function proceed() {
                    duplexStream.push(JSON.stringify(metadata));
                    duplexStream.push(null);
                }
                if (typeof isAnimated === 'boolean') {
                    metadata.animated = isAnimated;
                    proceed();
                } else if (animatedGifDetector) {
                    animatedGifDetector.on('decided', function (isAnimated) {
                        metadata.animated = isAnimated;
                        proceed();
                    });
                } else {
                    proceed();
                }
            });
        };
        duplexStream.on('finish', function () {
            sharpInstance.end();
        });
        pipeline.add(duplexStream);
        pipeline.targetType = 'json';
        pipeline.targetContentType = 'application/json; charset=utf-8';
    }
};
