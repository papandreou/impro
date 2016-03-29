/*global JSON*/
var Stream = require('stream');
var requireOr = require('require-or');
var _ = require('lodash');
var mime = require('mime');
var exifReader = require('exif-reader');
var util = require('util');
var icc = require('icc');
var errors = require('./errors');
var createAnimatedGifDetector = requireOr('animated-gif-detector');

mime.extensions['image/vnd.microsoft.icon'] = 'ico';

function getMockFileNameForContentType(contentType) {
    if (contentType) {
        return mime.extensions[contentType];
    }
}

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

function Impro(options, operations) {
    if (typeof options === 'string' || Array.isArray(options)) {
        operations = options;
        options = {};
    } else {
        options = options || {};
    }
    if (!(this instanceof Impro) || operations) {
        return new Impro(options).pipeline(_.omit(options, Impro.supportedOptions), operations);
    }
    _.extend(this, {defaultEngineName: Impro.defaultEngineName}, _.pick(options, Impro.supportedOptions));
}

Impro.supportedOptions = [ 'defaultEngineName', 'allowOperation', 'maxInputPixels', 'maxOutputPixels', 'root', 'engines' ];

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

Impro.prototype.pipeline = function (options, operations) {
    var pipeline = new Pipeline(this, options);
    if (operations) {
        pipeline.add(operations);
    }
    return pipeline;
};

function Pipeline(impro, options) {
    Stream.Duplex.call(this);
    this._queuedOperations = [];
    options = options || {};
    this.ended = false;
    this.impro = impro;
    this._streams = [];
    this.defaultEngineName = options.defaultEngineName || impro.defaultEngineName;
    this.sourceMetadata = _.omit(options, ['defaultEngineName', 'type']);
    if (options.type) {
        this.type(options.type);
    }
}

util.inherits(Pipeline, Stream.Duplex);

Pipeline.prototype.flush = function () {
    if (!this._flushed) {
        this._flushed = true;
        this.usedEngines = [];
        var startIndex = 0;
        var candidateEngineNames;
        var _flush = (upToIndex) => {
            if (startIndex < upToIndex) {
                if (this.targetType) {
                    candidateEngineNames = candidateEngineNames.filter(function (engineName) {
                        return Impro.engineByName[engineName].defaultOutputType || Impro.isSupportedByEngineNameAndOutputType[engineName][this.targetType];
                    }, this);
                }
                if (candidateEngineNames.length === 0) {
                    throw new Error('No supported engine can carry out this sequence of operations');
                }
                var engineName = candidateEngineNames[0];
                var options;
                if (this._queuedOperations[startIndex].name === engineName) {
                    options = this._queuedOperations[startIndex].args;
                    startIndex += 1;
                }
                var operations = this._queuedOperations.slice(startIndex, upToIndex);
                Impro.engineByName[engineName].execute(this, operations, options);
                operations.forEach(operation => operation.engineName = engineName);
                this.usedEngines.push({name: engineName, operations});
                startIndex = upToIndex;
            }
        };

        this._queuedOperations.forEach((operation, i) => {
            if (Impro.engineNamesByOperationName[operation.name]) {
                if (Impro.isTypeByName[operation.name]) {
                    this.targetType = operation.name;
                    this.targetContentType = mime.types[operation.name];
                }
                var filteredCandidateEngineNames = candidateEngineNames && candidateEngineNames.filter(
                    (engineName) => Impro.engineNamesByOperationName[operation.name].indexOf(engineName) !== -1
                );
                if (filteredCandidateEngineNames && filteredCandidateEngineNames.length > 0) {
                    candidateEngineNames = filteredCandidateEngineNames;
                } else {
                    _flush(i);
                    candidateEngineNames = Impro.engineNamesByOperationName[operation.name].filter((engineName) => {
                        var isSupportedByType = Impro.isSupportedByEngineNameAndInputType[engineName];
                        return (
                            !Impro.engineByName[engineName].unavailable,
                            this.impro[engineName] !== false &&
                            (engineName === operation.name || isSupportedByType['*'] || (this.targetType && isSupportedByType[this.targetType]))
                        );
                    });
                }
            }
        });
        _flush(this._queuedOperations.length);
        this._queuedOperations = undefined;
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
        this.on('finish', function () {
            this._streams[0].end();
        }.bind(this));
    }
    return this;
};

Pipeline.prototype._write = function (chunk, encoding, cb) {
    this.flush();
    this._streams[0].write(chunk, encoding);
    cb();
};

Pipeline.prototype._read = function (size) {
    this.flush();
    this._streams[this._streams.length - 1].read(size);
};

Pipeline.prototype._fail = function (err) {
    if (!this.ended) {
        this.ended = true;
        this.emit('error', err);
    }
};

Pipeline.prototype.add = function (operation) {
    // FIXME: Make a separate method for this
    if (operation && typeof operation.pipe === 'function') {
        this._streams.push(operation);
        return this;
    }
    if (this._flushed) {
        throw new Error('Cannot add more operations after the streaming has begun');
    }
    if (Array.isArray(operation)) {
        operation.forEach(operation => this.add(operation));
    } else if (typeof operation === 'string') {
        this.impro.parse(operation).operations.forEach(operation => this.add(operation));
    } else if (operation.name === 'type') {
        if (operation.args.length !== 1 || typeof operation.args[0] !== 'string') {
            throw new Error('Type must be given as a string');
        } else {
            var type = operation.args[0];
            if (Impro.isTypeByName[type]) {
                this.sourceType = this.targetType = type;
                this.targetContentType = mime.types[type];
            } else {
                var extension = mime.extensions[type.replace(/\s*;.*$/, '')];
                if (extension) {
                    if (Impro.isTypeByName[extension]) {
                        this.sourceType = this.targetType = extension;
                    }
                    this.targetContentType = type;
                }
            }
        }
    } else if (operation && typeof operation.name === 'string') {
        this._queuedOperations.push(operation);
    } else {
        throw new Error('add: Unsupported argument: ' + operation);
    }
    return this;
};

Impro.engineNamesByOperationName = {};

Impro.registerMethod = function (operationName) {
    Pipeline.prototype[operationName] = Pipeline.prototype[operationName] || function () {
        return this.add({name: operationName, args: Array.prototype.slice.call(arguments)});
    };

    Impro.prototype[operationName] = Impro.prototype[operationName] || function () {
        return this.pipeline().add({name: operationName, args: Array.prototype.slice.call(arguments)});
    };

    Impro[operationName] = Impro[operationName] || function () {
        return new Impro().pipeline().add({name: operationName, args: Array.prototype.slice.call(arguments)});
    };
};

Impro.registerMethod('type');

Impro.isOperationByEngineNameAndName = {};

Impro.engineNamesByOperationName = {};

Impro.engineByName = {};

Impro.isSupportedByEngineNameAndInputType = {};

Impro.isSupportedByEngineNameAndOutputType = {};

Impro.isTypeByName = {};

Impro.registerEngine = function (options) {
    var engineName = options.name;
    if (typeof options.unavailable === 'undefined') {
        options.unavailable = true;
    }
    Impro.defaultEngineName = Impro.defaultEngineName || engineName;
    Impro.isOperationByEngineNameAndName[engineName] = {};
    Impro.engineByName[options.name] = options;
    Impro.registerMethod(engineName);
    Impro.supportedOptions.push(engineName); // Allow disabling via new Impro({<engineName>: false})

    [engineName].concat(options.operations || []).forEach(function (operationName) {
        Impro.isOperationByEngineNameAndName[engineName][operationName] = true;
        (Impro.engineNamesByOperationName[operationName] = Impro.engineNamesByOperationName[operationName] || []).push(engineName);
        Impro.registerMethod(operationName);
    });
    Impro.isSupportedByEngineNameAndInputType[engineName] = {};
    (options.inputTypes || []).forEach(function (type) {
        Impro.isTypeByName[type] = true;
        Impro.isSupportedByEngineNameAndInputType[engineName][type] = true;
    });
    Impro.isSupportedByEngineNameAndOutputType[engineName] = {};
    (options.outputTypes || []).forEach(function (type) {
        Impro.registerMethod(type);
        (Impro.engineNamesByOperationName[type] = Impro.engineNamesByOperationName[type] || []).push(engineName);
        Impro.isTypeByName[type] = true;
        Impro.isSupportedByEngineNameAndOutputType[engineName][type] = true;
    });
};

var Gifsicle = requireOr('gifsicle-stream');
if (Gifsicle) {
    Impro.registerEngine({
        name: 'gifsicle',
        operations: [ 'crop', 'rotate', 'progressive', 'extract', 'resize', 'ignoreAspectRatio' ],
        inputTypes: [ 'gif' ],
        outputTypes: [ 'gif' ],
        execute: function (pipeline, operations) {
            var gifsicleArgs = [];
            var seenOperationThatMustComeBeforeExtract = false;
            function flush()  {
                if (gifsicleArgs.length > 0) {
                    pipeline.add(new Gifsicle(gifsicleArgs));
                    seenOperationThatMustComeBeforeExtract = false;
                    gifsicleArgs = [];
                }
            };

            var ignoreAspectRatio = operations.some(function (operation) {
                return operation.name === 'ignoreAspectRatio';
            });

            operations.forEach(function (operation) {
                if (operation.name === 'resize') {
                    seenOperationThatMustComeBeforeExtract = true;
                    gifsicleArgs.push('--resize' + (ignoreAspectRatio ? '' : '-fit'), operation.args[0] + 'x' + operation.args[1]);
                } else if (operation.name === 'extract') {
                    if (seenOperationThatMustComeBeforeExtract) {
                        flush();
                    }
                    gifsicleArgs.push('--crop', operation.args[0] + ',' + operation.args[1] + '+' + operation.args[2] + 'x' + operation.args[3]);
                } else if (operation.name === 'rotate' && /^(?:90|180|270)$/.test(operation.args[0])) {
                    gifsicleArgs.push('--rotate-' + operation.args[0]);
                    seenOperationThatMustComeBeforeExtract = true;
                } else if (operation.name === 'progressive') {
                    gifsicleArgs.push('--interlace');
                }
            }, this);
            flush();
            pipeline.targetType = 'gif';
            pipeline.targetContentType = 'image/gif';
        }
    });
}

var Inkscape = requireOr('inkscape');
if (Inkscape) {
    Impro.registerEngine({
        name: 'inkscape',
        inputTypes: [ 'svg' ],
        defaultOutputType: 'png',
        outputTypes: [ 'pdf', 'eps', 'png' ],
        execute: function (pipeline, operations, options) {
            var outputFormat = operations.length > 0 ? operations[operations.length - 1].name : 'png';
            var args = (operations[0] && operations[0].args) || [];
            if (outputFormat === 'pdf') {
                args.push('--export-pdf');
            } else if (outputFormat === 'eps') {
                args.push('--export-eps');
            } else if (!outputFormat || outputFormat === 'png') {
                pipeline.targetType = 'png';
                pipeline.targetContentType = 'image/png';
                args.push('--export-png');
            }
            pipeline.add(new Inkscape(args));
        }
    });
}

var sharp = requireOr('sharp');
Impro.registerEngine({
    name: 'sharpMetadata',
    unavailable: !sharp,
    operations: [ 'metadata' ],
    inputTypes: [ '*' ],
    outputTypes: [ 'json' ],
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
});

Impro.registerEngine({
    name: 'sharp',
    unavailable: !sharp,
    operations: ['resize', 'extract', 'sequentialRead', 'crop', 'max', 'background', 'embed', 'flatten', 'rotate', 'flip', 'flop', 'withoutEnlargement', 'ignoreAspectRatio', 'sharpen', 'interpolateWith', 'gamma', 'grayscale', 'greyscale', 'quality', 'progressive', 'withMetadata', 'compressionLevel'],
    inputTypes: [ 'jpeg', 'png', 'webp', '*' ],
    outputTypes: [ 'jpeg', 'png', 'webp' ],
    execute: function (pipeline, operations, options) {
        var impro = pipeline.impro;
        // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
        if (impro.sharp && typeof impro.sharp.cache !== 'undefined' && !impro._sharpCacheSet) {
            sharp.cache(impro.sharp.cache);
            impro._sharpCacheSet = true;
        }
        var sharpInstance = sharp();
        if (impro.maxInputPixels) {
            sharpInstance = sharpInstance.limitInputPixels(impro.maxInputPixels);
        }
        operations.forEach(function (operation) {
            var args = operation.args;
            if (operation.name === 'resize' && typeof impro.maxOutputPixels === 'number' && args[0] * args[1] > impro.maxOutputPixels) {
                throw new errors.OutputDimensionsExceeded('resize: Target dimensions of ' + args[0] + 'x' + args[1] + ' exceed maxOutputPixels (' + impro.maxOutputPixels + ')');
            }
            // Compensate for https://github.com/lovell/sharp/issues/276
            if (operation.name === 'extract' && args.length >= 4) {
                args = [ { left: args[0], top: args[1], width: args[2], height: args[3] } ];
            }
            return sharpInstance[operation.name](...args);
        });
        pipeline.add(sharpInstance);
    }
});

var gm = requireOr('gm');
Impro.registerEngine({
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
});

var OptiPng = requireOr('optipng');
Impro.registerEngine({
    name: 'optipng',
    unavailable: !OptiPng,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new OptiPng(options));
    }
});

var PngCrush = requireOr('pngcrush');

Impro.registerEngine({
    name: 'pngcrush',
    unavailable: !PngCrush,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new PngCrush(options));
    }
});

var PngQuant = requireOr('pngquant');
Impro.registerEngine({
    name: 'pngquant',
    unavailable: !PngQuant,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new PngQuant(options));
    }
});

var JpegTran = requireOr('jpegtran');
Impro.registerEngine({
    name: 'jpegtran',
    unavailable: !JpegTran,
    inputTypes: [ 'jpeg' ],
    outputTypes: [ 'jpeg' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new JpegTran(options));
    }
});

var SvgFilter = requireOr('svgfilter');
Impro.registerEngine({
    name: 'svgfilter',
    unavailable: !SvgFilter,
    inputTypes: [ 'svg' ],
    outputTypes: [ 'svg' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new SvgFilter(options[0]));
    }
});

module.exports = Impro;
