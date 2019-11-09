const requireOr = require('require-or');
const OptiPng = requireOr('optipng');

module.exports = {
  name: 'optipng',
  unavailable: !OptiPng,
  inputTypes: ['png'],
  outputTypes: ['png'],
  operations: ['o'],
  validateOperation: function(name, args) {
    return name === 'o' && args.length === 1 && args[0] >= 0 && args[0] <= 7;
  },
  execute: function(pipeline, operations, options) {
    var commandLineArgs = [];
    operations.forEach(({ name, args }) => {
      commandLineArgs.push('-' + name, ...args);
    });
    pipeline._attach(new OptiPng(commandLineArgs));
  }
};
