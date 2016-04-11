var Stream = require('stream');
var _ = require('lodash');
let mime = require('mime');

export default class Pipeline extends Stream.Duplex {
    constructor(impro, options) {
        super();
        this._queuedOperations = [];
        options = options || {};
        this.ended = false;
        this.impro = impro;
        this._streams = [];
        this.options = {};
        impro.supportedOptions.forEach(optionName => {
            this.options[optionName] = typeof options[optionName] !== 'undefined' ? options[optionName] : impro.options[optionName];
        });
        this.sourceMetadata = _.omit(options, impro.supportedOptions);
        if (options.type) {
            this.type(options.type);
        }
        this.isDisabledByEngineName = {};
    }

    flush() {
        if (this._flushed) {
            return this;
        }

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
                    if (this._queuedOperations[startIndex].args.length > 1) {
                        throw new Error('Engines take a max of one argument');
                    }
                    options = this._queuedOperations[startIndex].args[0];
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
                            !this.isDisabledByEngineName[engineName] &&
                            !this.impro.engineByName[engineName].unavailable &&
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

        return this;
    }

    _write(chunk, encoding, cb) {
        this.flush();
        this._streams[0].write(chunk, encoding);
        cb();
    }

    _read(size) {
        this.flush();
        this._streams[this._streams.length - 1].read(size);
    }

    _fail(err) {
        if (!this.ended) {
            this.ended = true;
            this.emit('error', err);
        }
    }

    add(operation) {
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
        } else if (operation && typeof operation.name === 'string') {
            this._queuedOperations.push(operation);
        } else {
            throw new Error('add: Unsupported argument: ' + operation);
        }
        return this;
    }

    type(type) {
        if (typeof type !== 'string') {
            throw new Error('Type must be given as a string');
        } else {
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
        return this;
    }

    source(source) {
        if (typeof source !== 'object') {
            throw new Error('Source must be given as an object');
        }
        _.extend(this.sourceMetadata, source);
        return this;
    }

    maxOutputPixels(maxOutputPixels) {
        if (typeof maxOutputPixels !== 'number') {
            throw new Error('Max input pixels must be given as a number');
        }
        this.options.maxOutputPixels = maxOutputPixels;
        return this;
    }

    maxInputPixels(maxInputPixels) {
        if (typeof maxInputPixels !== 'number') {
            throw new Error('Max input pixels must be given as a number');
        }
        this.options.maxInputPixels = maxInputPixels;
        return this;
    }
}
