const errors = require('../errors');
const requireOr = require('../requireOr');

const Gifsicle = requireOr('gifsicle-stream');

function isNumberWithin(num, min, max) {
  return typeof num === 'number' && num >= min && num <= max;
}

const maxDimension = 16384;

module.exports = {
  name: 'gifsicle',
  unavailable: !Gifsicle,
  operations: [
    'crop',
    'rotate',
    'progressive',
    'extract',
    'resize',
    'ignoreAspectRatio',
    'withoutEnlargement',
  ],
  inputTypes: ['gif'],
  outputTypes: ['gif'],
  validateOperation: function (name, args) {
    switch (name) {
      case 'crop':
        // FIXME: .crop(gravity) is presently ignored, seems like there's no mapping to gifsicle switches
        return (
          args.length === 1 &&
          /^(?:east|west|center|north(?:|west|east)|south(?:|west|east))/.test(
            args[0]
          )
        );
      case 'rotate':
        return (
          args.length === 0 ||
          (args.length === 1 &&
            (args[0] === 0 ||
              args[0] === 90 ||
              args[0] === 180 ||
              args[0] === 270))
        );
      case 'resize':
        return (
          args.length === 2 &&
          (args[0] === null || isNumberWithin(args[0], 1, maxDimension)) &&
          (args[1] === null || isNumberWithin(args[1], 1, maxDimension))
        );
      case 'extract':
        return (
          args.length === 4 &&
          isNumberWithin(args[0], 0, maxDimension - 1) &&
          isNumberWithin(args[1], 0, maxDimension - 1) &&
          isNumberWithin(args[2], 1, maxDimension) &&
          isNumberWithin(args[3], 1, maxDimension)
        );
      case 'quality':
        return args.length === 1 && isNumberWithin(args[0], 1, 100);
    }
  },
  execute: function (pipeline, operations) {
    const allGifsicleArgs = [];
    let gifsicleArgs = [];
    let seenOperationThatMustComeBeforeExtract = false;

    function flush() {
      if (gifsicleArgs.length > 0) {
        pipeline._attach(new Gifsicle(gifsicleArgs));
        seenOperationThatMustComeBeforeExtract = false;
        if (allGifsicleArgs.length > 0) allGifsicleArgs.push(';');
        allGifsicleArgs.push(...gifsicleArgs);
        gifsicleArgs = [];
      }
    }

    const ignoreAspectRatio = operations.some(
      (operation) => operation.name === 'ignoreAspectRatio'
    );

    operations.forEach((operation) => {
      if (operation.name === 'resize') {
        seenOperationThatMustComeBeforeExtract = true;

        if (typeof pipeline.options.maxOutputPixels === 'number') {
          const args = operation.args;
          const maxOutputPixels = pipeline.options.maxOutputPixels;

          if (args[0] * args[1] > maxOutputPixels) {
            throw new errors.OutputDimensionsExceeded(
              'resize: Target dimensions of ' +
                args[0] +
                'x' +
                args[1] +
                ' exceed maxOutputPixels (' +
                pipeline.options.maxOutputPixels +
                ')'
            );
          }

          if (args[0] === null && args[1] !== null) {
            args[0] = Math.floor(maxOutputPixels / args[1]);
          } else if (args[1] === null && args[0] !== null) {
            args[1] = Math.floor(maxOutputPixels / args[0]);
          }
        }

        if (operation.args[0] !== null && operation.args[1] !== null) {
          gifsicleArgs.push(
            '--resize' + (ignoreAspectRatio ? '' : '-fit'),
            operation.args[0] + 'x' + operation.args[1]
          );
        } else if (operation.args[1] === null) {
          gifsicleArgs.push('--resize-width', operation.args[0]);
        } else if (operation.args[0] === null) {
          gifsicleArgs.push('--resize-height', operation.args[1]);
        }
      } else if (operation.name === 'extract') {
        if (seenOperationThatMustComeBeforeExtract) {
          flush();
        }
        gifsicleArgs.push(
          '--crop',
          operation.args[0] +
            ',' +
            operation.args[1] +
            '+' +
            operation.args[2] +
            'x' +
            operation.args[3]
        );
      } else if (
        operation.name === 'rotate' &&
        /^(?:90|180|270)$/.test(operation.args[0])
      ) {
        gifsicleArgs.push('--rotate-' + operation.args[0]);
        seenOperationThatMustComeBeforeExtract = true;
      } else if (operation.name === 'progressive') {
        gifsicleArgs.push('--interlace');
      }
    }, this);
    flush();

    pipeline.targetType = 'gif';
    pipeline.targetContentType = 'image/gif';

    return allGifsicleArgs;
  },
};
