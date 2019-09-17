const Stream = require('stream');
const mime = require('mime');

module.exports = class Pipeline extends Stream.Duplex {
    constructor(impro, options) {
        super();

        this._onError = err => this._fail(err);
        this._queuedOperations = [];

        this.ended = false;
        this.impro = impro;
        this._streams = [];
        this.isDisabledByEngineName = {};
        this.options = {};

        const { type, supportedOptions, ...sourceMetadata } = options || {};
        (supportedOptions || []).forEach(optionName => {
            this.options[optionName] =
                typeof options[optionName] !== 'undefined'
                    ? options[optionName]
                    : impro.options[optionName];
        });
        this.sourceMetadata = sourceMetadata;
        if (type) {
            this.type(type);
        }
    }

    flush(isStream = false) {
        if (this._flushed) {
            return this;
        }

        this._flushed = true;
        this.usedEngines = [];
        var startIndex = 0;
        var candidateEngineNames;

        var _flush = upToIndex => {
            if (startIndex >= upToIndex) {
                return;
            }

            try {
                if (this.targetType) {
                    candidateEngineNames = candidateEngineNames.filter(
                        engineName => {
                            return (
                                this.impro.engineByName[engineName]
                                    .defaultOutputType ||
                                this.impro.isSupportedByEngineNameAndOutputType[
                                    engineName
                                ][this.targetType]
                            );
                        }
                    );
                }
                if (candidateEngineNames.length === 0) {
                    throw new Error(
                        'No supported engine can carry out this sequence of operations'
                    );
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
                var operations = this._queuedOperations.slice(
                    startIndex,
                    upToIndex
                );
                this.impro.engineByName[engineName].execute(
                    this,
                    operations,
                    options
                );
                operations.forEach(
                    operation => (operation.engineName = engineName)
                );
                this.usedEngines.push({ name: engineName, operations });
                startIndex = upToIndex;
            } catch (e) {
                if (isStream) {
                    this._fail(e, this.usedEngines.length + 1);
                } else {
                    throw e;
                }
            }
        };

        this._queuedOperations.forEach((operation, i) => {
            if (this.impro.engineNamesByOperationName[operation.name]) {
                if (
                    this.impro.engineByName[operation.name] &&
                    typeof operation.args[0] === 'boolean'
                ) {
                    const isEnabled = operation.args[0];
                    this.isDisabledByEngineName[operation.name] = !isEnabled;
                    if (i === 0) {
                        startIndex += 1;
                    } else {
                        _flush(i);
                    }
                    candidateEngineNames = undefined;
                    return;
                }

                if (this.impro.isTypeByName[operation.name]) {
                    this.targetType = operation.name;
                    this.targetContentType = mime.types[operation.name];
                }

                if (!candidateEngineNames) {
                    candidateEngineNames = this._selectEnginesForOperation(
                        operation.name,
                        this.targetType
                    );
                }

                var filteredCandidateEngineNames = candidateEngineNames.filter(
                    engineName =>
                        this.impro.isValidOperationForEngine(
                            engineName,
                            operation.name,
                            operation.args
                        )
                );

                if (filteredCandidateEngineNames.length > 0) {
                    candidateEngineNames = filteredCandidateEngineNames;
                } else {
                    _flush(i);

                    candidateEngineNames = this._selectEnginesForOperation(
                        operation.name,
                        this.targetType
                    );
                }
            }
        });

        _flush(this._queuedOperations.length);

        this._queuedOperations = undefined;
        this._streams.push(new Stream.PassThrough());
        this._streams.forEach(function(stream, i) {
            if (i < this._streams.length - 1) {
                stream.pipe(this._streams[i + 1]);
            } else {
                stream
                    .on('readable', () => this.push(stream.read()))
                    .on('end', () => this.push(null));
            }
            // protect against filters emitting errors more than once
            stream.once('error', err => this._fail(err, i));
        }, this);
        this.on('finish', () => this._finish());
        this.once('error', this._onError);

        return this;
    }

    _selectEnginesForOperation(operationName, targetType) {
        const impro = this.impro;

        return impro.engineNamesByOperationName[operationName].filter(
            engineName => {
                var isSupportedByType =
                    impro.isSupportedByEngineNameAndInputType[engineName];
                return (
                    !this.isDisabledByEngineName[engineName] &&
                    !impro.engineByName[engineName].unavailable &&
                    impro[engineName] !== false &&
                    (engineName === operationName ||
                        isSupportedByType['*'] ||
                        (targetType && isSupportedByType[targetType]))
                );
            }
        );
    }

    _write(chunk, encoding, cb) {
        this.flush(true);
        this._streams[0].write(chunk, encoding);
        cb();
    }

    _read(size) {
        this.flush(true);
        this._streams[this._streams.length - 1].read(size);
    }

    _fail(err, streamIndex = -1) {
        if (this.ended) {
            return;
        }

        this.ended = true;

        this._streams.forEach(filter => {
            if (filter.unpipe) {
                filter.unpipe();
            }
            if (filter.kill) {
                filter.kill();
            } else if (filter.destroy) {
                filter.destroy();
            } else if (filter.resume) {
                filter.resume();
            }
            if (filter.end) {
                filter.end();
            }
            if (
                filter._readableState &&
                filter._readableState.buffer &&
                filter._readableState.buffer.length > 0
            ) {
                filter._readableState.buffer = [];
            }
            filter.removeAllListeners();
            // protect against filters emitting errors more than once
            filter.on('error', () => {});
        });

        if (streamIndex > -1) {
            // unhook pipeline error handler to avoid re-entry
            this.removeListener('error', this._onError);
            // now signal the error on the pipeline
            this.emit('error', err);
        }
    }

    _finish() {
        this._streams[0].end();
    }

    _attach(stream) {
        if (!(stream && typeof stream.pipe === 'function')) {
            throw new Error('Cannot attach something that is not a stream');
        }

        this._streams.push(stream);
    }

    add(operation) {
        if (this._flushed) {
            throw new Error(
                'Cannot add more operations after the streaming has begun'
            );
        }
        if (operation && typeof operation.name === 'string') {
            this._queuedOperations.push(operation);
        } else {
            throw new Error(
                `add: Unsupported argument: ${JSON.stringify(operation)}`
            );
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
        Object.assign(this.sourceMetadata, source);
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
};
