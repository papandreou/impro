const _ = require('lodash');
const mime = require('mime');
const Pipeline = require('./Pipeline');

mime.define({
  'image/vnd.microsoft.icon': ['ico']
});

module.exports = class Impro {
  constructor(options) {
    if (!options || typeof options === 'object') {
      options = Object.assign({}, options);
    } else {
      throw new Error('invalid options');
    }

    this.options = options;
    this.engineByName = {};
    this.engineNamesByOperationName = {};
    this.isSupportedByEngineNameAndInputType = {};
    this.isSupportedByEngineNameAndOutputType = {};
    this.isTypeByName = {};

    this.supportedOptions = [
      'defaultEngineName',
      'allowOperation',
      'maxInputPixels',
      'maxOutputPixels',
      'sharpCache',
      'svgAssetPath'
    ];

    this.restrictedOptions = ['svgAssetPath'];

    _.extend(
      this,
      { defaultEngineName: Impro.defaultEngineName },
      _.pick(options, this.supportedOptions)
    );

    this._Pipeline = class extends Pipeline {};

    [
      'type',
      'source',
      'maxInputPixels',
      'maxOutputPixels'
    ].forEach(propertyName => this.registerMethod(propertyName));
  }

  createPipeline(options, operations) {
    if (typeof options === 'string' || Array.isArray(options)) {
      operations = options;
      options = undefined;
    }

    const pipeline = new this._Pipeline(this, {
      ...options,
      engines: _.pick(options, Object.keys(this.engineByName)), // Allow disabling via createPipeline({<engineName>: false})
      supportedOptions: this.supportedOptions
    });

    if (operations) {
      if (typeof operations === 'string') {
        operations = this.parse(operations).operations;
      } else if (!Array.isArray(operations)) {
        throw new Error(
          'Pipeline creation can only be supplied an operations array or string'
        );
      }

      operations.forEach(operation => pipeline.add(operation));
    }

    return pipeline;
  }

  registerMethod(operationName) {
    if (!this._Pipeline.prototype[operationName]) {
      const _impro = this;
      this._Pipeline.prototype[operationName] = function(...args) {
        if (
          !(
            _impro.engineByName[operationName] ||
            _impro.isValidOperation(operationName, args)
          )
        ) {
          throw new Error(
            `invalid operation or arguments: ${operationName}=${JSON.stringify(
              args
            )}`
          );
        }
        return this.add({ name: operationName, args });
      };
    }
    this[operationName] = (...args) =>
      this.createPipeline()[operationName](...args);
    return this;
  }

  add(operation) {
    return this.createPipeline().add(operation);
  }

  use(options) {
    var engineName = options.name;
    if (typeof options.unavailable === 'undefined') {
      options.unavailable = true;
    }
    if (typeof options.validateOperation === 'undefined') {
      // Will allow all options.operations that don't take any arguments:
      options.validateOperation = function() {};
    }
    this.defaultEngineName = this.defaultEngineName || engineName;

    this.engineByName[options.name] = options;
    this.registerMethod(engineName);

    [engineName].concat(options.operations || []).forEach(operationName => {
      (this.engineNamesByOperationName[operationName] =
        this.engineNamesByOperationName[operationName] || []).push(engineName);
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
      this.isTypeByName[type] = true;
      (this.engineNamesByOperationName[type] =
        this.engineNamesByOperationName[type] || []).push(engineName);
      this.isSupportedByEngineNameAndOutputType[engineName][type] = true;
    });
    return this;
  }

  getEngine(engineName) {
    let engine;
    engineName = typeof engineName === 'string' ? engineName : '';
    if (engineName && (engine = this.engineByName[engineName])) {
      return engine;
    } else {
      throw new Error(`unknown engine ${engineName || 'unknown'}`);
    }
  }

  isOperationSupportedByEngine(name, engineName) {
    return (this.engineNamesByOperationName[name] || []).includes(engineName);
  }

  isValidOperation(name, args) {
    var engineNames = this.engineNamesByOperationName[name];
    return (
      engineNames &&
      engineNames.some(function(engineName) {
        var isValid = this.engineByName[engineName].validateOperation(
          name,
          args
        );
        return isValid || (typeof isValid === 'undefined' && args.length === 0);
      }, this)
    );
  }

  parse(queryString, allowOperation) {
    allowOperation =
      typeof allowOperation === 'function'
        ? allowOperation
        : this.allowOperation;

    var keyValuePairs = queryString.split('&');
    var operations = [];
    var leftOverQueryStringFragments = [];
    var consumedQueryStringFragments = [];

    keyValuePairs.forEach(function(keyValuePair) {
      var matchKeyValuePair = keyValuePair.match(/^([^=]+)(?:=(.*))?/);
      if (matchKeyValuePair) {
        var operationName = decodeURIComponent(matchKeyValuePair[1]);
        // Split by non-URL encoded comma or plus:
        var operationArgs = matchKeyValuePair[2]
          ? matchKeyValuePair[2].split(/[+,]/).map(function(arg) {
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
            })
          : [];

        if (operationName in this.engineByName) {
          // engines accept only a single options object argument, so
          // in cases where the query string contains options intended
          // for the engine itself we must put them in an object which
          // we can then pass as that only supported argument
          const engineOptions = {};
          operationArgs.forEach(arg => {
            if (typeof arg !== 'string' || arg.indexOf('=') === -1) return;
            const [optionKey, optionValue] = arg.split('=');
            if (this.restrictedOptions.includes(optionKey)) return;
            engineOptions[optionKey] = optionValue;
          });

          if (Object.keys(engineOptions).length > 0) {
            operationArgs = [engineOptions];
          } else {
            operationArgs = [];
          }
        }

        // empty resize args must be passed to engines as null
        if (operationName === 'resize') {
          operationArgs = operationArgs.map(arg => arg || null);
        }

        if (
          !this.isValidOperation(operationName, operationArgs) ||
          (typeof allowOperation === 'function' &&
            !allowOperation(operationName, operationArgs))
        ) {
          leftOverQueryStringFragments.push(keyValuePair);
        } else {
          operations.push({
            name: operationName,
            args: operationArgs
          });
          consumedQueryStringFragments.push(keyValuePair);
        }
      }
    }, this);

    return {
      operations: operations,
      leftover: leftOverQueryStringFragments.join('&'),
      consumed: consumedQueryStringFragments.join('&')
    };
  }
};
