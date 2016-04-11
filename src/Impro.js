/*global JSON*/
let _ = require('lodash');
let mime = require('mime');
let Pipeline = require('./Pipeline');

mime.define({
    'image/vnd.microsoft.icon': ['ico']
});

export default class Impro {
    constructor(options, operations) {
        if (typeof options === 'string' || Array.isArray(options)) {
            operations = options;
            this.options = {};
        } else {
            this.options = _.extend({}, options);
        }

        this.isOperationByEngineNameAndName = {};
        this.engineNamesByOperationName = {};
        this.engineByName = {};
        this.isSupportedByEngineNameAndInputType = {};
        this.isSupportedByEngineNameAndOutputType = {};
        this.isTypeByName = {};

        this.supportedOptions = [ 'defaultEngineName', 'allowOperation', 'maxInputPixels', 'maxOutputPixels', 'root', 'engines' ];

        _.extend(this, {defaultEngineName: Impro.defaultEngineName}, _.pick(options, this.supportedOptions));

        class PrivatePipeline extends Pipeline {
            constructor(impro, options) {
                super(impro, options);
            }
        };

        this.createPrivatePipeline = function (options, operations) {
            var pipeline = new PrivatePipeline(this, options);
            if (operations) {
                pipeline.add(operations);
            }
            return pipeline;
        };

        this.registerMethod = function (operationName, fn) {
            if (!PrivatePipeline.prototype[operationName]) {
                PrivatePipeline.prototype[operationName] = fn || function (...args) {
                    return this.add({name: operationName, args});
                };

                this[operationName] = (...args) => this.createPrivatePipeline()[operationName](...args);
            }
            return this;
        };

        this.registerMethod('type', function (type) {
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
        });

        this.registerMethod('source', function (source) {
            if (typeof source !== 'object') {
                throw new Error('Source must be given as an object');
            }
            _.extend(this.sourceMetadata, source);
            return this;
        });

        this.registerMethod('maxOutputPixels', function (maxOutputPixels) {
            if (typeof maxOutputPixels !== 'number') {
                throw new Error('Max input pixels must be given as a number');
            }
            this.options.maxOutputPixels = maxOutputPixels;
            return this;
        });

        this.registerMethod('maxInputPixels', function (maxInputPixels) {
            if (typeof maxInputPixels !== 'number') {
                throw new Error('Max input pixels must be given as a number');
            }
            this.options.maxInputPixels = maxInputPixels;
            return this;
        });

        this.add = function (...rest) {
            return this.createPrivatePipeline().add(...rest);
        };
    }

    set(options) {
        _.merge(this.engineByName, options);
        return this;
    }

    use(options) {
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
    }

    isValidOperation(name, args) {
        var engineNames = this.engineNamesByOperationName[name];
        return engineNames && engineNames.some(function (engineName) {
            var isValid = this.engineByName[engineName].validateOperation(name, args);
            return isValid || (typeof isValid === 'undefined' && args.length === 0);
        }, this);
    }

    isValidOperationForEngine(engineName, name, args) {
        var isValid = this.engineNamesByOperationName[name].indexOf(engineName) !== -1 && this.engineByName[engineName].validateOperation(name, args);
        return isValid || (typeof isValid === 'undefined' && args.length === 0);
    }

    parse(queryString) {
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
    }
}
