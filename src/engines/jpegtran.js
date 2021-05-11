const requireOr = require('../requireOr');

const JpegTran = requireOr('jpegtran');

function isNumberWithin(num, min, max) {
  return typeof num === 'number' && num >= min && num <= max;
}

const maxDimension = 16384;

module.exports = {
  name: 'jpegtran',
  unavailable: !JpegTran,
  inputTypes: ['jpeg'],
  outputTypes: ['jpeg'],
  operations: [
    'copy',
    'crop',
    'optimize',
    'progressive',
    'extract',
    'grayscale',
    'flip',
    'perfect',
    'rotate',
    'transpose',
    'transverse',
    'trim',
    'arithmetic',
    'restart',
    'maxmemory',
  ],
  validateOperation: function (name, args) {
    switch (name) {
      case 'arithmetic':
      case 'grayscale':
      case 'perfect':
      case 'progressive':
      case 'transpose':
      case 'transverse':
        return args.length === 0;
      case 'copy':
        return (
          args.length === 1 &&
          (args[1] === 'none' || args[1] === 'comments' || args[1] === 'all')
        );
      // Alias as extract for compatibility with sharp/gm/gifsicle
      case 'extract':
      case 'crop':
        return (
          args.length === 4 &&
          isNumberWithin(args[0], 0, maxDimension - 1) &&
          isNumberWithin(args[1], 0, maxDimension - 1) &&
          isNumberWithin(args[2], 1, maxDimension) &&
          isNumberWithin(args[3], 1, maxDimension)
        );
      case 'flip':
        return (
          args.length === 1 &&
          (args[0] === 'horizontal' || args[0] === 'vertical')
        );
      case 'rotate':
        return (
          args.length === 1 &&
          (args[0] === 90 || args[0] === 180 || args[0] === 270)
        );
      case 'maxmemory':
      case 'restart':
        return (
          args.length === 1 &&
          typeof args[0] === 'number' &&
          args[0] > 0 &&
          args[0] === Math.floor(args[0])
        );
    }
  },
  execute: function (pipeline, operations, options) {
    const commandLineArgs = [];
    operations.forEach(({ name, args }) => {
      if (name === 'extract') {
        commandLineArgs.push(
          '-crop',
          args[2] + 'x' + args[3] + '+' + args[0] + '+' + args[1]
        );
      } else if (name === 'crop') {
        commandLineArgs.push(
          '-crop',
          args[0] + 'x' + args[1] + '+' + args[2] + '+' + args[3]
        );
      } else {
        commandLineArgs.push('-' + name, ...args);
      }
    });

    pipeline._attach(new JpegTran(commandLineArgs));

    return commandLineArgs;
  },
};
