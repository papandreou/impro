const requireOr = require('../requireOr');

const PngQuant = requireOr('pngquant');

module.exports = {
  name: 'pngquant',
  unavailable: !PngQuant,
  inputTypes: ['png'],
  outputTypes: ['png'],
  operations: [
    'floyd',
    'ncolors',
    'nofs',
    'ordered',
    'speed',
    'quality',
    'posterize',
    'iebug',
  ],
  validateOperation: function (name, args) {
    switch (name) {
      case 'floyd':
        return (
          args.length === 0 ||
          (args.length === 1 &&
            /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(String(args[0])))
        );
      case 'ncolors':
        return args.length === 1 && args[0] >= 2 && args[0] <= 256;
      case 'speed':
        return args.length === 1 && args[0] >= 1 && args[0] <= 11;
      case 'quality':
        return (
          args.length === 1 &&
          typeof args[0] === 'string' &&
          /^(?:0|[1-9][0-9]|100)-(?:0|[1-9][0-9]|100)$/.test(args[0])
        );
      case 'posterize':
        return args.length === 1 && /^[0-4]$/.test(String(args[0]));
    }
  },
  execute: function (pipeline, operations, options) {
    const commandLineArgs = [];
    let nColors;
    operations.forEach((operation) => {
      if (operation.name === 'ncolors') {
        nColors = operation.args[0];
        return;
      }
      commandLineArgs.push('--' + operation.name, ...operation.args);
    });
    if (nColors) {
      commandLineArgs.push(nColors);
    }
    commandLineArgs.push('-');

    pipeline._attach(new PngQuant(commandLineArgs));

    return commandLineArgs;
  },
};
