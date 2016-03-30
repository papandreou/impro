/*global JSON*/
var Stream = require('stream');
var _ = require('lodash');
var util = require('util');
var mime = require('mime');

mime.extensions['image/vnd.microsoft.icon'] = 'ico';

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

Impro.prototype.isValidOperation = function (name, args) {
    var engineNames = Impro.engineNamesByOperationName[name];
    return engineNames && engineNames.some(function (engineName) {
        var isValid = Impro.engineByName[engineName].validateOperation(name, args);
        return isValid || (typeof isValid === 'undefined' && args.length === 0);
    });
};

Impro.prototype.isValidOperationForEngine = function (engineName, name, args) {
    var isValid = Impro.engineNamesByOperationName[name].indexOf(engineName) !== -1 && Impro.engineByName[engineName].validateOperation(name, args);
    return isValid || (typeof isValid === 'undefined' && args.length === 0);
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

            if (!this.isValidOperation(operationName, operationArgs) || (typeof this.allowOperation === 'function' && !this.allowOperation(operationName, operationArgs))) {
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
                    engineName => this.impro.isValidOperationForEngine(engineName, operation.name, operation.args)
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

Impro.use = function (options) {
    var engineName = options.name;
    if (typeof options.unavailable === 'undefined') {
        options.unavailable = true;
    }
    if (typeof options.validateOperation === 'undefined') {
        // Will allow all options.operations that don't take any arguments:
        options.validateOperation = function () {};
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
    return this;
};

Impro
    .use(require('./engines/gifsicle'))
    .use(require('./engines/sharp'))
    .use(require('./engines/metadata'))
    .use(require('./engines/inkscape'))
    .use(require('./engines/jpegtran'))
    .use(require('./engines/optipng'))
    .use(require('./engines/pngquant'))
    .use(require('./engines/pngcrush'))
    .use(require('./engines/svgfilter'))
    .use(require('./engines/gm'));

module.exports = Impro;
