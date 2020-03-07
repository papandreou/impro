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
      if (!Array.isArray(operations)) {
        throw new Error(
          'Pipeline creation can only be supplied an operations array'
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
};
