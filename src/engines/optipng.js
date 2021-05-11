const requireOr = require('../requireOr');

const OptiPng = requireOr('optipng');

module.exports = {
  name: 'optipng',
  unavailable: !OptiPng,
  inputTypes: ['png'],
  outputTypes: ['png'],
  operations: ['o'],
  validateOperation: function (name, args) {
    switch (name) {
      case 'o':
        return (
          args.length === 1 &&
          typeof args[0] === 'number' &&
          args[0] >= 0 &&
          args[0] <= 7
        );
    }
  },
  execute: function (pipeline, operations, options) {
    const commandLineArgs = [];

    operations.forEach(({ name, args }) => {
      commandLineArgs.push('-' + name, ...args);
    });
    pipeline._attach(new OptiPng(commandLineArgs));

    return commandLineArgs;
  },
};
