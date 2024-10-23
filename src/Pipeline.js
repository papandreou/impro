const Stream = require('stream');
const Path = require('path');

const mime = require('./mime');

function mapValues(obj, valueFn) {
  const target = { ...obj };
  for (const [key, value] of Object.entries(obj)) {
    target[key] = valueFn(value);
  }
  return target;
}

module.exports = class Pipeline extends Stream.Duplex {
  constructor(impro, options) {
    super();

    this._flushed = false;
    this._onError = (err) => this._fail(err);
    this._preflush = false;
    this._queuedOperations = [];
    this._streams = [];

    this.ended = false;
    this.impro = impro;
    this.options = {};
    this.optionsByEngineName = {};
    this.usedEngines = [];

    Object.defineProperty(this, 'isDisabledByEngineName', {
      get: () => {
        return mapValues(this.optionsByEngineName, ({ disabled }) => disabled);
      },
    });

    options = options || {};
    const { type, engines, supportedOptions, sourceMetadata } = options;
    (supportedOptions || []).forEach((optionName) => {
      this.options[optionName] =
        typeof options[optionName] !== 'undefined'
          ? options[optionName]
          : impro.options[optionName];
    });

    const engineOptions = engines || {};
    Object.keys(this.impro.engineByName).forEach((engineName) => {
      const isAvailable = !impro.engineByName[engineName].unavailable;

      let isEnabled;
      let perEngineOptions;
      if (typeof engineOptions[engineName] === 'boolean') {
        isEnabled = engineOptions[engineName];
        perEngineOptions = null;
      } else if (!engineOptions[engineName]) {
        isEnabled = true;
        perEngineOptions = null;
      } else {
        isEnabled = true;
        perEngineOptions = engineOptions[engineName];
      }

      const disabled = !(isEnabled && isAvailable);

      this.optionsByEngineName[engineName] = Object.assign(
        { disabled },
        perEngineOptions
      );
    });

    if (this.options.svgAssetPath) {
      if (!Path.isAbsolute(this.options.svgAssetPath)) {
        throw new Error('Pipeline: svgAssetPath must be absolute');
      }
    }

    this.sourceMetadata = sourceMetadata || {};

    this.sourceType = undefined;
    this.targetType = undefined;
    this.targetContentType = undefined;
    if (type) {
      this.type(type);
    }
  }

  flush(isStream = false) {
    if (this._flushed) {
      return this;
    }

    this._flushed = true;

    let startIndex = 0;
    let lastSelectedEngineName;
    let candidateEngineNames;

    const _flush = (upToIndex) => {
      if (startIndex >= upToIndex) {
        return;
      }

      try {
        if (this.targetType) {
          candidateEngineNames = candidateEngineNames.filter(
            (engineName) =>
              this.impro.engineByName[engineName].defaultOutputType ||
              this.impro.isSupportedByEngineNameAndOutputType[engineName][
                this.targetType
              ]
          );
        }
        if (candidateEngineNames.length === 0) {
          throw new Error(
            'No supported engine can carry out this sequence of operations'
          );
        }
        const engineName = candidateEngineNames[0];
        const options = this.optionsByEngineName[engineName];

        if (this._queuedOperations[startIndex].name === engineName) {
          if (this._queuedOperations[startIndex].args.length > 1) {
            throw new Error('Engines take a max of one argument');
          }
          const engineArgument = this._queuedOperations[startIndex].args[0];
          Object.assign(options, engineArgument);
          startIndex += 1;
        }

        const operations = this._queuedOperations.slice(startIndex, upToIndex);
        const commandArgs = this.impro.engineByName[engineName].execute(
          this,
          operations,
          options
        );
        operations.forEach((operation) => (operation.engineName = engineName));

        this.usedEngines.push({
          name: engineName,
          operations,
          commandArgs:
            commandArgs && engineName !== 'sharp' ? commandArgs : null,
        });

        startIndex = upToIndex;
      } catch (e) {
        if (isStream) {
          this._fail(e, true);
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
          this.optionsByEngineName[operation.name].disabled = !isEnabled;
          if (i === 0) {
            startIndex += 1;
          } else {
            _flush(i);
          }
          lastSelectedEngineName = undefined;
          candidateEngineNames = undefined;
          return;
        }

        if (!candidateEngineNames) {
          candidateEngineNames = this._selectEnginesForOperation(
            operation.name,
            this.targetType
          );
        }

        const filteredCandidateEngineNames = candidateEngineNames.filter(
          (engineName) =>
            this._isValidOperationForEngine(
              engineName,
              operation.name,
              operation.args
            )
        );

        if (!lastSelectedEngineName) {
          lastSelectedEngineName = filteredCandidateEngineNames[0];
        }

        const hasCandidates = filteredCandidateEngineNames.length > 0;
        if (
          hasCandidates &&
          lastSelectedEngineName === filteredCandidateEngineNames[0]
        ) {
          if (this.impro.isTypeByName[operation.name]) {
            this.targetType = operation.name;
            this.targetContentType = mime.getType(operation.name);
          }

          candidateEngineNames = filteredCandidateEngineNames;
        } else {
          // Execute up to index i of the queued operations on
          // the currently selected engine.
          _flush(i);

          // If a type conversion triggers a change in the
          // selected engine we ensure any prior operations
          // are executed with the *original* target type and
          // only then set the new type after the flush.
          if (this.impro.isTypeByName[operation.name]) {
            this.targetType = operation.name;
            this.targetContentType = mime.getType(operation.name);
          }

          lastSelectedEngineName = undefined;
          candidateEngineNames = this._selectEnginesForOperation(
            operation.name,
            this.targetType
          );
        }
      }
    });

    if (!Array.isArray(candidateEngineNames)) {
      // protect against no engine selection occurring
      // in the case that all operations were invalid
      candidateEngineNames = [];
    }

    _flush(this._queuedOperations.length);

    this._queuedOperations = undefined;

    // Account for stream implementation differences by making
    // sure the stream which interfaces with the Pipeline (i.e.
    // the Duplex steam ultimate handed out to callers) is also
    // a 'standard' internal stream.
    const lastStream = new Stream.PassThrough();
    lastStream
      .on('readable', () => this.push(lastStream.read()))
      .on('end', () => this.push(null))
      .on('error', (err) => this._fail(err, true));
    this._streams.push(lastStream);

    // Wire the streams to each other
    this._streams.forEach(function (stream, i) {
      if (stream === lastStream) {
        // ignore given it is wired to the pipeline separately
        return;
      }

      stream.pipe(this._streams[i + 1]);

      // protect against filters emitting errors more than once
      stream.once('error', (err) => {
        try {
          const engineName = this.usedEngines[i].name;
          let commandArgs;
          if (!(err instanceof Error)) {
            const messageForNonError = `${engineName} emitted non-Error (stream index ${i})`;
            err = new Error(messageForNonError);
            commandArgs = null;
          } else if (err.commandArgs) {
            commandArgs = err.commandArgs;
          } else {
            commandArgs = this.usedEngines[i].commandArgs;
          }
          if (commandArgs) {
            err.commandLine = `${engineName} ${commandArgs.join(' ')}`;
          }
          this._fail(err, true);
        } catch (e) {
          this._fail(e, true);
        }
      });
    }, this);
    this.on('finish', () => this._finish());
    this.once('error', this._onError);

    return this;
  }

  _isValidOperationForEngine(engineName, name, args) {
    if (this.impro.isOperationSupportedByEngine(name, engineName)) {
      const engine = this.impro.getEngine(engineName);
      const isValid = engine.validateOperation(name, args);
      return isValid || (typeof isValid === 'undefined' && args.length === 0);
    }

    return false;
  }

  _selectEnginesForOperation(operationName, targetType) {
    const impro = this.impro;

    return impro.engineNamesByOperationName[operationName].filter(
      (engineName) => {
        const isSupportedByType =
          impro.isSupportedByEngineNameAndInputType[engineName];
        return (
          !this.optionsByEngineName[engineName].disabled &&
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

  _fail(err, isErrorFromStream = false) {
    if (this.ended) {
      return;
    }

    this.ended = true;

    this._streams.forEach((filter) => {
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

    if (isErrorFromStream) {
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
    if (this._preflush) {
      throw new Error('Cannot add non-streams after calling addStream()');
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

  addStream(stream) {
    this._preflush = true;
    this._attach(stream);
    this.usedEngines.push({ name: '_stream', commandArgs: null });
    return this;
  }

  type(type) {
    if (typeof type !== 'string') {
      throw new Error('Type must be given as a string');
    } else {
      if (this.impro.isTypeByName[type]) {
        this.sourceType = this.targetType = type;
        this.targetContentType = mime.getType(type);
      } else {
        const extension = mime.getExtension(type);
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
