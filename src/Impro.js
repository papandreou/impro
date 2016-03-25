/*global JSON*/
var Stream = require('stream');
var _ = require('lodash');
var mime = require('mime');
var exifReader = require('exif-reader');
var util = require('util');
var icc = require('icc');
var sharp;
var Gifsicle;
var filterConstructorByOperationName = {};
var errors = require('./errors');

['PngQuant', 'PngCrush', 'OptiPng', 'JpegTran', 'Inkscape', 'SvgFilter'].forEach(function (constructorName) {
    try {
        filterConstructorByOperationName[constructorName.toLowerCase()] = require(constructorName.toLowerCase());
    } catch (e) {}
});

function getMockFileNameForContentType(contentType) {
    if (contentType) {
        if (contentType === 'image/vnd.microsoft.icon') {
            return '.ico';
        }
        return mime.extensions[contentType];
    }
}

try {
    sharp = require('sharp');
} catch (e) {}

try {
    Gifsicle = require('gifsicle-stream');
} catch (e) {}

function isNumberWithin(num, min, max) {
    return typeof num === 'number' && num >= min && num <= max;
}

function isValidOperation(name, args) {
    var maxDimension = 16384;
    switch (name) {
    case 'crop':
        return args.length === 1 && /^(?:east|west|center|north(?:|west|east)|south(?:|west|east))/.test(args[0]);
    case 'rotate':
        return args.length === 0 || (args.length === 1 && (args[0] === 0 || args[0] === 90 || args[0] === 180 || args[0] === 270));
    case 'resize':
        return args.length === 2 && isNumberWithin(args[0], 1, maxDimension) && isNumberWithin(args[1], 1, maxDimension);
    case 'extract':
        return args.length === 4 && isNumberWithin(args[0], 0, maxDimension - 1) && isNumberWithin(args[1], 0, maxDimension - 1) && isNumberWithin(args[2], 1, maxDimension) && isNumberWithin(args[3], 1, maxDimension);
    case 'interpolateWith':
        return args.length === 1 && /^(?:nearest|bilinear|vertexSplitQuadraticBasisSpline|bicubic|locallyBoundedBicubic|nohalo)$/.test(args[0]);
    case 'background':
        return args.length === 1 && /^#[0-9a-f]{6}$/.test(args[0]);
    case 'blur':
        return args.length === 0 || (args.length === 1 && isNumberWithin(args[0], 0.3, 1000));
    case 'sharpen':
        return args.length <= 3 &&
            (typeof args[0] === 'undefined' || typeof args[0] === 'number') &&
            (typeof args[1] === 'undefined' || typeof args[1] === 'number') &&
            (typeof args[2] === 'undefined' || typeof args[2] === 'number');
    case 'threshold':
        return args.length === 0 || (args.length === 1 && isNumberWithin(args[0], 0, 255));
    case 'gamma':
        return args.length === 0 || (args.length === 1 && isNumberWithin(args[0], 1, 3));
    case 'quality':
        return args.length === 1 && isNumberWithin(args[0], 1, 100);
    case 'tile':
        return args.length <= 2 &&
            (typeof args[0] === 'undefined' || isNumberWithin(args[0], 1, 8192)) &&
            (typeof args[1] === 'undefined' || isNumberWithin(args[0], 0, 8192));
    case 'compressionLevel':
        return args.length === 1 && isNumberWithin(args[0], 0, 9);
    case 'png':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'withoutEnlargement':
    case 'progressive':
    case 'ignoreAspectRatio':
    case 'embed':
    case 'max':
    case 'min':
    case 'negate':
    case 'flatten':
    case 'flip':
    case 'flop':
    case 'grayscale':
    case 'greyscale':
    case 'normalize':
    case 'withMetadata':
    case 'withoutChromaSubsampling':
    case 'withoutAdaptiveFiltering':
    case 'trellisQuantization':
    case 'trellisQuantisation':
    case 'overshootDeringing':
    case 'optimizeScans':
    case 'optimiseScans':
        return args.length === 0;
    // Not supported: overlayWith

    case 'metadata':
        return args.length === 0 || (args.length === 1 && args[0] === true);

    // Engines:
    case 'sharp':
    case 'gm':
        return args.length === 0;

    // FIXME: Add validation code for all the below.
    // https://github.com/papandreou/express-processimage/issues/4
    // Other engines:
    case 'pngcrush':
    case 'pngquant':
    case 'jpegtran':
    case 'optipng':
    case 'svgfilter':
    case 'inkscape':
        return true;

    // Graphicsmagick specific operations:
    // FIXME: Add validation code for all the below.
    // https://github.com/papandreou/express-processimage/issues/4
    case 'setFormat':
    case 'identify':
    case 'selectFrame':
    case 'subCommand':
    case 'adjoin':
    case 'affine':
    case 'alpha':
    case 'append':
    case 'authenticate':
    case 'average':
    case 'backdrop':
    case 'blackThreshold':
    case 'bluePrimary':
    case 'border':
    case 'borderColor':
    case 'box':
    case 'channel':
    case 'chop':
    case 'clip':
    case 'coalesce':
    case 'colorize':
    case 'colorMap':
    case 'compose':
    case 'compress':
    case 'convolve':
    case 'createDirectories':
    case 'deconstruct':
    case 'define':
    case 'delay':
    case 'displace':
    case 'display':
    case 'dispose':
    case 'dissolve':
    case 'encoding':
    case 'endian':
    case 'file':
    case 'flatten':
    case 'foreground':
    case 'frame':
    case 'fuzz':
    case 'gaussian':
    case 'geometry':
    case 'greenPrimary':
    case 'highlightColor':
    case 'highlightStyle':
    case 'iconGeometry':
    case 'intent':
    case 'lat':
    case 'level':
    case 'list':
    case 'log':
    case 'loop':
    case 'map':
    case 'mask':
    case 'matte':
    case 'matteColor':
    case 'maximumError':
    case 'mode':
    case 'monitor':
    case 'mosaic':
    case 'motionBlur':
    case 'name':
    case 'noop':
    case 'normalize':
    case 'opaque':
    case 'operator':
    case 'orderedDither':
    case 'outputDirectory':
    case 'page':
    case 'pause':
    case 'pen':
    case 'ping':
    case 'pointSize':
    case 'preview':
    case 'process':
    case 'profile':
    case 'progress':
    case 'randomThreshold':
    case 'recolor':
    case 'redPrimary':
    case 'remote':
    case 'render':
    case 'repage':
    case 'sample':
    case 'samplingFactor':
    case 'scene':
    case 'scenes':
    case 'screen':
    case 'set':
    case 'segment':
    case 'shade':
    case 'shadow':
    case 'sharedMemory':
    case 'shave':
    case 'shear':
    case 'silent':
    case 'rawSize':
    case 'snaps':
    case 'stegano':
    case 'stereo':
    case 'textFont':
    case 'texture':
    case 'threshold':
    case 'thumbnail':
    case 'tile':
    case 'title':
    case 'transform':
    case 'transparent':
    case 'treeDepth':
    case 'update':
    case 'units':
    case 'unsharp':
    case 'usePixmap':
    case 'view':
    case 'virtualPixel':
    case 'visual':
    case 'watermark':
    case 'wave':
    case 'whitePoint':
    case 'whiteThreshold':
    case 'window':
    case 'windowGroup':
    case 'strip':
    case 'interlace':
    case 'setFormat':
    case 'resizeExact':
    case 'scale':
    case 'filter':
    case 'density':
    case 'noProfile':
    case 'resample':
    case 'rotate':
    case 'magnify':
    case 'minify':
    case 'quality':
    case 'charcoal':
    case 'modulate':
    case 'antialias':
    case 'bitdepth':
    case 'colors':
    case 'colorspace':
    case 'comment':
    case 'contrast':
    case 'cycle':
    case 'despeckle':
    case 'dither':
    case 'monochrome':
    case 'edge':
    case 'emboss':
    case 'enhance':
    case 'equalize':
    case 'gamma':
    case 'implode':
    case 'label':
    case 'limit':
    case 'median':
    case 'negative':
    case 'noise':
    case 'paint':
    case 'raise':
    case 'lower':
    case 'region':
    case 'roll':
    case 'sharpen':
    case 'solarize':
    case 'spread':
    case 'swirl':
    case 'type':
    case 'trim':
    case 'extent':
    case 'gravity':
    case 'background':
    case 'fill':
    case 'stroke':
    case 'strokeWidth':
    case 'font':
    case 'fontSize':
    case 'draw':
    case 'drawPoint':
    case 'drawLine':
    case 'drawRectangle':
    case 'drawArc':
    case 'drawEllipse':
    case 'drawCircle':
    case 'drawPolyline':
    case 'drawPolygon':
    case 'drawBezier':
    case 'drawText':
    case 'setDraw':
    case 'thumb':
    case 'thumbExact':
    case 'morph':
    case 'sepia':
    case 'autoOrient':
    case 'in':
    case 'out':
    case 'preprocessor':
    case 'addSrcFormatter':
    case 'inputIs':
    case 'compare':
    case 'composite':
    case 'montage':
        return true;
    default:
        return false;
    }
}

function Impro(options) {
    if (!(this instanceof Impro)) {
        return new Impro().pipeline(options);
    }
    options = options || {};

    this.filters = options.filters || {};
    this.root = options.root;
    this.defaultEngineName = options.defaultEngineName || Impro.defaultEngineName;
    this.allowOperation = options.allowOperation;
    this.maxInputPixels = options.maxInputPixels;
    this.maxOutputPixels = options.maxOutputPixels;
}

Impro.prototype.checkSharpOrGmOperation = function (operation) {
    if (operation.name === 'resize' && typeof this.maxOutputPixels === 'number' && operation.args[0] * operation.args[1] > this.maxOutputPixels) {
        throw new errors.OutputDimensionsExceeded('resize: Target dimensions of ' + operation.args[0] + 'x' + operation.args[1] + ' exceed maxOutputPixels (' + this.maxOutputPixels + ')');
    }
};

Impro.prototype.parse = function (queryString) {
    var keyValuePairs = queryString.split('&');
    var operations = [];
    var leftOverQueryStringFragments = [];

    keyValuePairs.forEach(function (keyValuePair) {
        var matchKeyValuePair = keyValuePair.match(/^([^=]+)(?:=(.*))?/);
        if (matchKeyValuePair) {
            var operationName = decodeURIComponent(matchKeyValuePair[1]),
                // Split by non-URL encoded comma or plus:
                operationArgs = matchKeyValuePair[2] ? matchKeyValuePair[2].split(/[\+,]/).map(function (arg) {
                    arg = decodeURIComponent(arg);
                    if (/^\d+$/.test(arg)) {
                        return parseInt(arg, 10);
                    } else if (arg === 'true') {
                        return true;
                    } else if (arg === 'false') {
                        return false;
                    } else {
                        return arg;
                    }
                }) : [];

            if (!isValidOperation(operationName, operationArgs) || (typeof this.allowOperation === 'function' && !this.allowOperation(operationName, operationArgs))) {
                leftOverQueryStringFragments.push(keyValuePair);
            } else {
                operations.push({ name: operationName, args: operationArgs });
            }
        }
    }, this);

    return {
        operations: operations,
        leftover: leftOverQueryStringFragments.join('&')
    };
};

Impro.prototype.pipeline = function (opSpecs, options) {
    var pipeline = new Pipeline(this, options);
    if (opSpecs) {
        pipeline.add(opSpecs);
    }
    return pipeline;
};

function Pipeline(impro, options) {
    Stream.Duplex.call(this);
    options = options || {};
    this.ended = false;
    this.impro = impro;
    this.targetContentType = options && options.sourceContentType;
    this._streams = [];
    this.queue = [];
}

util.inherits(Pipeline, Stream.Duplex);

Pipeline.prototype._freeze = function () {
    if (!this._frozen) {
        this._flush();
        this._streams.push(new Stream.PassThrough());
        this._streams.forEach(function (stream, i) {
            if (i < this._streams.length - 1) {
                stream.pipe(this._streams[i + 1]);
            } else {
                stream.on('readable', function () {
                    this.push(stream.read());
                }.bind(this)).on('end', function () {
                    this.push(null);
                }.bind(this));
            }
            stream.on('error', this._fail.bind(this));
        }, this);
        this._frozen = true;

        var end = this.end;
        this.end = function () {
            return end.apply(this, arguments);
        };
        this.on('finish', function () {
            this._streams[0].end();
        }.bind(this));
    }
};

Pipeline.prototype._write = function (chunk, encoding, cb) {
    this._freeze();
    this._streams[0].write(chunk, encoding);
    cb();
};

Pipeline.prototype._read = function (size) {
    this._freeze();
    this._streams[this._streams.length - 1].read(size);
};

Pipeline.prototype._fail = function (err) {
    if (!this.ended) {
        this.ended = true;
        this.emit('error', err);
    }
};

Pipeline.prototype._flush = function () {
    if (this.queue.length > 0) {
        var that = this;
        var engineName = this.currentEngineName;

        var sourceContentType = this.sourceContentType;
        if (sourceContentType === 'image/gif' && !this.queue.some(function (operation) {
            return operation.name === 'png' || operation.name === 'webp' || operation.name === 'jpeg';
        })) {
            engineName = 'gm';
            // Gotcha: gifsicle does not support --resize-fit in a way where the image will be enlarged
            // to fit the bounding box, so &withoutEnlargement is assumed, but not required:
            // Raised the issue here: https://github.com/kohler/gifsicle/issues/13#issuecomment-196321546
            if (this.impro.filters.gifsicle !== false && Gifsicle && this.queue.every(function (operation) {
                return operation.name === 'resize' || operation.name === 'extract' || operation.name === 'rotate' || operation.name === 'withoutEnlargement' || operation.name === 'progressive' || operation.name === 'crop' || operation.name === 'ignoreAspectRatio';
            })) {
                engineName = 'gifsicle';
            }
        }
        if (engineName === 'gifsicle') {
            var gifsicleArgs = [];
            this.queue.forEach(function (operation) {
                if (operation.name === 'resize') {
                    if (operations.some(function (operation) { return operation.name === 'ignoreAspectRatio'; })) {
                        gifsicleArgs.push('--resize', operation.args[0] + 'x' + operation.args[1]);
                    } else {
                        gifsicleArgs.push('--resize-fit', operation.args[0] + 'x' + operation.args[1]);
                    }
                } else if (operation.name === 'extract') {
                    gifsicleArgs.push('--crop', operation.args[0] + ',' + operation.args[1] + '+' + operation.args[2] + 'x' + operation.args[3]);
                } else if (operation.name === 'rotate' && /^(?:90|180|270)$/.test(operation.args[0])) {
                    gifsicleArgs.push('--rotate-' + operation.args[0]);
                } else if (operation.name === 'progressive') {
                    gifsicleArgs.push('--interlace');
                }
            });
            this.add(new Gifsicle(gifsicleArgs));
            this.targetContentType = 'image/gif';
        } else if (engineName === 'sharp') {
            if (this.impro.maxInputPixels) {
                this.queue.unshift({name: 'limitInputPixels', args: [this.impro.maxInputPixels]});
            }
            this.add(this.queue.reduce(function (sharpInstance, operation) {
                that.impro.checkSharpOrGmOperation(operation);
                var args = operation.args;
                // Compensate for https://github.com/lovell/sharp/issues/276
                if (operation.name === 'extract' && args.length >= 4) {
                    args = [ { left: args[0], top: args[1], width: args[2], height: args[3] } ];
                }
                return sharpInstance[operation.name].apply(sharpInstance, args);
            }, sharp()));
        } else if (engineName === 'gm') {
            var gmOperationsForThisInstance = this.queue;
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
                        gmInstance = gm(readStream, getMockFileNameForContentType(gmOperationsForThisInstance[0].sourceContentType));
                    if (that.impro.maxInputPixels) {
                        gmInstance.limit('pixels', that.impro.maxInputPixels);
                    }
                    var resize;
                    var crop;
                    var withoutEnlargement;
                    var ignoreAspectRatio;
                    for (var i = 0 ; i < gmOperationsForThisInstance.length ; i += 1) {
                        var gmOperation = gmOperationsForThisInstance[i];
                        if (gmOperation.name === 'resize') {
                            resize = gmOperation;
                        } else if (gmOperation.name === 'crop') {
                            crop = gmOperation;
                        } else if (gmOperation.name === 'withoutEnlargement') {
                            withoutEnlargement = gmOperation;
                        } else if (gmOperation.name === 'ignoreAspectRatio') {
                            ignoreAspectRatio = gmOperation;
                        }
                    }
                    if (withoutEnlargement && resize) {
                        resize.args[1] += '>';
                    }
                    if (ignoreAspectRatio && resize) {
                        resize.args[1] += '!';
                    }
                    if (resize && crop) {
                        gmOperationsForThisInstance.push({
                            name: 'extent',
                            args: [].concat(resize.args)
                        });
                        resize.args.push('^');
                    }
                    gmOperationsForThisInstance.reduce(function (gmInstance, gmOperation) {
                        that.impro.checkSharpOrGmOperation(gmOperation);
                        if (gmOperation.name === 'rotate' && gmOperation.args.length === 1) {
                            gmOperation = _.extend({}, gmOperation);
                            gmOperation.args = ['transparent', gmOperation.args[0]];
                        }
                        if (gmOperation.name === 'extract') {
                            gmOperation.name = 'crop';
                            gmOperation.args = [gmOperation.args[2], gmOperation.args[3], gmOperation.args[0], gmOperation.args[1]];
                        } else if (gmOperation.name === 'crop') {
                            gmOperation.name = 'gravity';
                            gmOperation.args = [
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
                                }[String(gmOperation.args[0]).toLowerCase()] || 'Center'
                            ];
                        }
                        if (gmOperation.name === 'progressive') {
                            gmOperation.name = 'interlace';
                            gmOperation.args = [ 'line' ];
                        }
                        // There are many, many more that could be supported:
                        if (gmOperation.name === 'webp' || gmOperation.name === 'png' || gmOperation.name === 'jpeg' || gmOperation.name === 'gif') {
                            gmOperation = _.extend({}, gmOperation);
                            gmOperation.args.unshift(gmOperation.name);
                            gmOperation.name = 'setFormat';
                        }
                        if (typeof gmInstance[gmOperation.name] === 'function') {
                            return gmInstance[gmOperation.name].apply(gmInstance, gmOperation.args);
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
            this.add(readWriteStream);
        } else {
            throw new Error('Internal error');
        }
        this.queue = [];
    }
    this.currentEngineName = undefined;
};

Pipeline.prototype.add = function (options) {
    if (this._frozen) {
        throw new Error('Cannot add more operations after the streaming has begun');
    }
    if (options && typeof options.pipe === 'function') {
        this._streams.push(options);
    } else if (Array.isArray(options)) {
        options.forEach(function (operation) {
            this.add(operation);
        }, this);
    } else if (typeof options === 'string') {
        this.impro.parse(options).operations.forEach(function (operation) {
            this.add(operation);
        }, this);
    } else if (options && options.operations) {
        options.operations.forEach(function (operation) {
            this.add(opSpec);
        }, this);
    } else if (typeof options.name === 'string') {
        var currentEngineName;
        var operationName = options.name;
        var operationArgs = options.args;
        var filter;
        if (operationName === 'sourceType') {
            if (this.queue.length > 0 || this._streams.length > 0) {
                throw new Error('sourceType must be called before any operations are performed');
            } else if (operationArgs.length !== 1 || typeof operationArgs[0] !== 'string') {
                throw new Error('sourceType must be given as a string');
            } else {
                var contentType = mime.types[operationArgs[0]] || operationArgs[0];
                this.sourceContentType = this.targetContentType = contentType;
            }
        } else if (this.impro.filters[operationName]) {
            this._flush();
            filter = this.impro.filters[operationName](operationArgs, {
                numPreceedingFilters: filterInfos.length
            });
            if (filter) {
                filter.usedQueryStringFragments = [keyValuePair];
                filter.operationName = operationName;
                if (filter.outputContentType) {
                    this.targetContentType = filter.outputContentType;
                }
            }
        } else if (operationName === 'metadata' && sharp) {
            this._flush();
            var sharpInstance = sharp();
            var duplexStream = new Stream.Duplex();
            duplexStream._write = function (chunk, encoding, cb) {
                if (sharpInstance.write(chunk, encoding) === false) {
                    sharpInstance.once('drain', cb);
                } else {
                    cb();
                }
            };
            var alreadyKnownMetadata = { contentType: this.targetContentType };
            duplexStream._read = function (size) {
                sharpInstance.metadata(function (err, metadata) {
                    if (err) {
                        return duplexStream.emit('error', err);
                    }
                    if (metadata.format === 'magick') {
                        // https://github.com/lovell/sharp/issues/377
                        metadata.contentType = sourceContentType;
                        metadata.format = sourceContentType && sourceContentType.replace(/^image\//, '');
                    } else if (metadata.format) {
                        // metadata.format is one of 'jpeg', 'png', 'webp' so this should be safe:
                        metadata.contentType = 'image/' + metadata.format;
                    }
                    if (metadata.format === 'magick') {
                        metadata.format = undefined; // So that alreadyKnownMetadata.contentType will overwrite it
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
                    duplexStream.push(JSON.stringify(metadata));
                    duplexStream.push(null);
                });
            };
            duplexStream.on('finish', function () {
                sharpInstance.end();
            });
            this._streams.push(duplexStream);
            this.targetContentType = 'application/json; charset=utf-8';
        } else if (Impro.isOperationByEngineNameAndName[operationName]) {
            this._flush();
            this.currentEngineName = operationName;
        } else if (Impro.engineNamesByOperationName[operationName]) {
            // Hack: This should be moved into the specific engines:
            var conversionToContentType = mime.types[operationName];
            if (conversionToContentType) {
                this.targetContentType = conversionToContentType;
            }

            // Check if at least one of the engines supporting this operation is allowed
            var candidateEngineNames = Impro.engineNamesByOperationName[operationName].filter(function (engineName) {
                return this.impro.filters[engineName] !== false;
            }, this);
            if (candidateEngineNames.length > 0) {
                if (this.currentEngineName && !Impro.isOperationByEngineNameAndName[this.currentEngineName]) {
                    this._flush();
                }

                if (!this.currentEngineName || candidateEngineNames.indexOf(this.currentEngineName) === -1) {
                    if (candidateEngineNames.indexOf(this.impro.defaultEngineName) !== -1) {
                        this.currentEngineName = this.impro.defaultEngineName;
                    } else {
                        this.currentEngineName = candidateEngineNames[0];
                    }
                }
                var sourceContentType = this.targetContentType;
                if (operationName === 'setFormat' && operationArgs.length > 0) {
                    var targetFormat = operationArgs[0].toLowerCase();
                    if (targetFormat === 'jpg') {
                        targetFormat = 'jpeg';
                    }
                    this.targetContentType = 'image/' + targetFormat;
                } else if (operationName === 'jpeg' || operationName === 'png' || operationName === 'webp') {
                    this.targetContentType = 'image/' + operationName;
                }
                this.queue.push({sourceContentType: sourceContentType, name: operationName, args: operationArgs});
            }
        } else {
            var operationNameLowerCase = operationName.toLowerCase(),
                FilterConstructor = filterConstructorByOperationName[operationNameLowerCase];
            if (FilterConstructor && filters[operationNameLowerCase] !== false) {
                this._flush();
                if (operationNameLowerCase === 'svgfilter' && this.impro.root && options.sourceFilePath) {
                    operationArgs.push('--root', 'file://' + this.impro.root, '--url', 'file://' + options.sourceFilePath);
                }
                filter = new FilterConstructor(operationArgs);
                if (operationNameLowerCase === 'inkscape') {
                    this.targetContentType = 'image/' + filter.outputFormat;
                }
                this._streams.push(filter);
            }
        }
    }
    return this;
};

Impro.engineNamesByOperationName = {};

Impro.registerMethod = function (operationName) {
    Pipeline.prototype[operationName] = Pipeline.prototype[operationName] || function () {
        return this.add({name: operationName, args: Array.prototype.slice.call(arguments)});
    };

    Impro.prototype[operationName] = Impro.prototype[operationName] || function () {
        return this.pipeline({name: operationName, args: Array.prototype.slice.call(arguments)});
    };

    Impro[operationName] = Impro[operationName] || function () {
        return new Impro().pipeline({name: operationName, args: Array.prototype.slice.call(arguments)});
    };
};

Impro.registerMethod('sourceType');

Impro.isOperationByEngineNameAndName = {};

Impro.engineNamesByOperationName = {};

Impro.registerEngine = function (options) {
    var engineName = options.name;
    Impro.defaultEngineName = Impro.defaultEngineName || engineName;
    Impro.isOperationByEngineNameAndName[engineName] = {};
    options.operations.forEach(function (operationName) {
        Impro.isOperationByEngineNameAndName[engineName][operationName] = true;
        (Impro.engineNamesByOperationName[operationName] = Impro.engineNamesByOperationName[operationName] || []).push(engineName);
        Impro.registerMethod(operationName);
    });
};

var sharp;
try {
    sharp = require('sharp');
} catch (e) {}

if (sharp) {
    Impro.registerEngine({
        name: 'sharp',
        operations: ['metadata', 'resize', 'extract', 'sequentialRead', 'crop', 'max', 'background', 'embed', 'flatten', 'rotate', 'flip', 'flop', 'withoutEnlargement', 'ignoreAspectRatio', 'sharpen', 'interpolateWith', 'gamma', 'grayscale', 'greyscale', 'jpeg', 'png', 'webp', 'quality', 'progressive', 'withMetadata', 'compressionLevel']
    });
}

var gm;
try {
    gm = require('gm');
} catch (e) {}

if (gm) {
    Impro.registerEngine({
        name: 'gm',
        operations: ['gif', 'png', 'jpeg', 'extract'].concat(Object.keys(gm.prototype).filter(function (propertyName) {
            return (!/^_|^(?:emit|.*Listeners?|on|once|size|orientation|format|depth|color|res|filesize|identity|write|stream)$/.test(propertyName) &&
                typeof gm.prototype[propertyName] === 'function');
        }))
    });
}


module.exports = Impro;