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

    this.isOperationByEngineNameAndName = {};
    this.engineNamesByOperationName = {};
    this.engineByName = {};
    this.isSupportedByEngineNameAndInputType = {};
    this.isSupportedByEngineNameAndOutputType = {};
    this.isTypeByName = {};

    this.supportedOptions = [ 'defaultEngineName', 'allowOperation', 'maxInputPixels', 'maxOutputPixels', 'root', 'engines' ];

    _.extend(this, {defaultEngineName: Impro.defaultEngineName}, _.pick(options, this.supportedOptions));

    function Pipeline(impro, options) {
        Stream.Duplex.call(this);
        this._queuedOperations = [];
        options = options || {};
        this.ended = false;
        this.impro = impro;
        this._streams = [];
        impro.supportedOptions.forEach(optionName => {
            this[optionName] = typeof options[optionName] !== 'undefined' ? options[optionName] : impro[optionName];
        });
        this.sourceMetadata = _.omit(options, impro.supportedOptions);
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
                        candidateEngineNames = candidateEngineNames.filter(engineName => {
                            return this.impro.engineByName[engineName].defaultOutputType || this.impro.isSupportedByEngineNameAndOutputType[engineName][this.targetType];
                        });
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
                    this.impro.engineByName[engineName].execute(this, operations, options);
                    operations.forEach(operation => operation.engineName = engineName);
                    this.usedEngines.push({name: engineName, operations});
                    startIndex = upToIndex;
                }
            };

            this._queuedOperations.forEach((operation, i) => {
                if (this.impro.engineNamesByOperationName[operation.name]) {
                    if (this.impro.isTypeByName[operation.name]) {
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
                        candidateEngineNames = this.impro.engineNamesByOperationName[operation.name].filter(engineName => {
                            var isSupportedByType = this.impro.isSupportedByEngineNameAndInputType[engineName];
                            return (
                                !this.impro.engineByName[engineName].unavailable,
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
                if (this.impro.isTypeByName[type]) {
                    this.sourceType = this.targetType = type;
                    this.targetContentType = mime.types[type];
                } else {
                    var extension = mime.extensions[type.replace(/\s*;.*$/, '')];
                    if (extension) {
                        if (this.impro.isTypeByName[extension]) {
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

    this.createPipeline = function (options, operations) {
        var pipeline = new Pipeline(this, options);
        if (operations) {
            pipeline.add(operations);
        }
        return pipeline;
    };

    this.registerMethod = function (operationName) {
        Pipeline.prototype[operationName] = function () {
            return this.add({name: operationName, args: Array.prototype.slice.call(arguments)});
        };

        this[operationName] = function () {
            // why tf is this necessary?
            if (this instanceof Pipeline) {
                return this.add({name: operationName, args: Array.prototype.slice.call(arguments)});
            } else {
                return this.createPipeline().add({name: operationName, args: Array.prototype.slice.call(arguments)});
            }
        };
    };

    this.registerMethod('type');
    this.add = function (...rest) {
        return this.createPipeline().add(...rest);
    };
}

Impro.prototype.set = function (options) {
    _.extend(this, options);
    return this;
};

Impro.prototype.use = function (options) {
    var engineName = options.name;
    if (typeof options.unavailable === 'undefined') {
        options.unavailable = true;
    }
    if (typeof options.validateOperation === 'undefined') {
        // Will allow all options.operations that don't take any arguments:
        options.validateOperation = function () {};
    }
    this.defaultEngineName = this.defaultEngineName || engineName;
    this.isOperationByEngineNameAndName[engineName] = {};
    this.engineByName[options.name] = options;
    this.registerMethod(engineName);
    this.supportedOptions.push(engineName); // Allow disabling via new Impro({<engineName>: false})

    [engineName].concat(options.operations || []).forEach(operationName => {
        this.isOperationByEngineNameAndName[engineName][operationName] = true;
        (this.engineNamesByOperationName[operationName] = this.engineNamesByOperationName[operationName] || []).push(engineName);
        this.registerMethod(operationName);
    });
    this.isSupportedByEngineNameAndInputType[engineName] = {};
    (options.inputTypes || []).forEach(type => {
        this.isTypeByName[type] = true;
        this.isSupportedByEngineNameAndInputType[engineName][type] = true;
    });
    this.isSupportedByEngineNameAndOutputType[engineName] = {};
    (options.outputTypes || []).forEach(type => {
        this.registerMethod(type);
        (this.engineNamesByOperationName[type] = this.engineNamesByOperationName[type] || []).push(engineName);
        this.isTypeByName[type] = true;
        this.isSupportedByEngineNameAndOutputType[engineName][type] = true;
    });
    return this;
};

Impro.prototype.isValidOperation = function (name, args) {
    var engineNames = this.engineNamesByOperationName[name];
    return engineNames && engineNames.some(function (engineName) {
        var isValid = this.engineByName[engineName].validateOperation(name, args);
        return isValid || (typeof isValid === 'undefined' && args.length === 0);
    }, this);
};

Impro.prototype.isValidOperationForEngine = function (engineName, name, args) {
    var isValid = this.engineNamesByOperationName[name].indexOf(engineName) !== -1 && this.engineByName[engineName].validateOperation(name, args);
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

module.exports = Impro;
