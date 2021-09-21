const errors = require('../errors');
const requireOr = require('../requireOr');

const sharp = requireOr('sharp');

function isNumberWithin(num, min, max) {
  return typeof num === 'number' && num >= min && num <= max;
}

function locatePreviousCommand(operations, nameToFind) {
  return operations.findIndex((operation) => operation.name === nameToFind);
}

function patchPreviousCommandArgument(operation, argUpdates, indexInArg) {
  operation = { ...operation };
  operation.args = [...operation.args];
  operation.args[indexInArg] = {
    ...operation.args[indexInArg],
    ...argUpdates,
  };
  return operation;
}

const maxDimension = 16384;
const optionsToOutputType = {
  progressive: true,
  quality: true,
};
const optionsToResize = {
  withoutEnlargement: () => ({ withoutEnlargement: true }),
  ignoreAspectRatio: () => ({ fit: 'fill' }),
};
const variationsToResize = {
  crop: (args) => ({ fit: 'cover', position: args[0] }),
  embed: (args) => ({ fit: 'contain', position: args[0] }),
};

module.exports = {
  name: 'sharp',
  library: sharp,
  unavailable: !sharp,
  operations: [
    'resize',
    'extract',
    'sequentialRead',
    'crop',
    'max',
    'background',
    'embed',
    'flatten',
    'negate',
    'rotate',
    'flip',
    'flop',
    'withoutEnlargement',
    'ignoreAspectRatio',
    'blur',
    'sharpen',
    'threshold',
    'trim',
    'interpolateWith',
    'gamma',
    'grayscale',
    'greyscale',
    'quality',
    'progressive',
    'withMetadata',
    'compressionLevel',
    'normalize',
    'normalise',
    'withoutAdaptiveFiltering',
    'trellisQuantisation',
    'trellisQuantization',
    'overshootDeringing',
    'optimizeScans',
    'optimiseScans',
  ],
  inputTypes: ['jpeg', 'png', 'webp', 'svg', 'tiff', 'avif', '*'],
  outputTypes: ['jpeg', 'png', 'webp', 'tiff', 'dzi', 'avif'],
  validateOperation: function (name, args) {
    switch (name) {
      case 'crop':
      case 'embed':
        return (
          args.length === 1 &&
          /^(?:east|west|center|north(?:|west|east)|south(?:|west|east)|attention|entropy)$/.test(
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
      case 'interpolateWith':
        return (
          args.length === 1 &&
          /^(?:nearest|bilinear|vertexSplitQuadraticBasisSpline|bicubic|locallyBoundedBicubic|nohalo)$/.test(
            args[0]
          )
        );
      case 'background':
        return args.length === 1 && /^#[0-9a-f]{6}$/.test(args[0]);
      case 'blur':
        return (
          args.length === 0 ||
          (args.length === 1 && isNumberWithin(args[0], 0.3, 1000))
        );
      case 'sharpen':
        return (
          args.length <= 3 &&
          (typeof args[0] === 'undefined' || typeof args[0] === 'number') &&
          (typeof args[1] === 'undefined' || typeof args[1] === 'number') &&
          (typeof args[2] === 'undefined' || typeof args[2] === 'number')
        );
      case 'threshold':
        return (
          args.length === 0 ||
          (args.length === 1 && isNumberWithin(args[0], 0, 255))
        );
      case 'gamma':
        return (
          args.length === 0 ||
          (args.length === 1 && isNumberWithin(args[0], 1, 3))
        );
      case 'quality':
        return args.length === 1 && isNumberWithin(args[0], 1, 100);
      case 'tile':
        return (
          args.length <= 2 &&
          (typeof args[0] === 'undefined' ||
            isNumberWithin(args[0], 1, 8192)) &&
          (typeof args[1] === 'undefined' || isNumberWithin(args[0], 0, 8192))
        );
      case 'compressionLevel':
        return args.length === 1 && isNumberWithin(args[0], 0, 9);
    }
  },
  execute: function (pipeline, operations, options) {
    options = options ? { ...options } : {};
    const impro = pipeline.impro;
    const cache = pipeline.options.sharpCache || options.cache;
    const failOnError = (() => {
      // TODO: Switch to using "Nullish coalescing operator (??)" once only Node.js 14 onwards are supported
      if (typeof pipeline.options.sharpFailOnError !== 'undefined') {
        return pipeline.options.sharpFailOnError;
      } else if (typeof options.failOnError !== 'undefined') {
        return options.failOnError;
      } else {
        return true;
      }
    })();
    // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
    if (cache !== 'undefined' && !impro._sharpCacheSet) {
      sharp.cache(cache);
      impro._sharpCacheSet = true;
    }

    const operationsForExecution = [];

    if (pipeline.targetType) {
      operationsForExecution.push({
        name: pipeline.targetType,
        args: [],
      });
    }

    operations.forEach((operation) => {
      let name = operation.name;
      let args = operation.args.slice(0);

      if (operation.name === 'resize') {
        args[2] = { fit: 'inside' };

        if (typeof pipeline.options.maxOutputPixels === 'number') {
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
      }

      // handle those operations in sharp crop implemented as variations of resize
      if (operation.name in variationsToResize) {
        const locatedIndex = locatePreviousCommand(
          operationsForExecution,
          'resize'
        );
        const resizeOptions = variationsToResize[operation.name](args);
        if (locatedIndex > -1) {
          const locatedOperation = patchPreviousCommandArgument(
            operationsForExecution[locatedIndex],
            resizeOptions,
            2
          );
          operationsForExecution[locatedIndex] = locatedOperation;
          return;
        } else {
          name = 'resize';
          args = [null, null, resizeOptions];
        }
      }

      // handle those operations in sharp implemented as options to resize
      if (operation.name in optionsToResize) {
        const locatedIndex = locatePreviousCommand(
          operationsForExecution,
          'resize'
        );
        if (locatedIndex > -1) {
          const locatedOperation = patchPreviousCommandArgument(
            operationsForExecution[locatedIndex],
            optionsToResize[operation.name](args),
            2
          );
          operationsForExecution[locatedIndex] = locatedOperation;
          return;
        } else {
          throw new Error(
            `sharp: ${operation.name}() operation must follow resize`
          );
        }
      }

      if (name in optionsToOutputType) {
        const locatedIndex = locatePreviousCommand(
          operationsForExecution,
          pipeline.targetType
        );
        if (locatedIndex > -1) {
          const locatedOperation = patchPreviousCommandArgument(
            operationsForExecution[locatedIndex],
            { [name]: args.length === 1 ? args[0] : true },
            0
          );
          operationsForExecution[locatedIndex] = locatedOperation;
          return;
        } else {
          throw new Error(
            `sharp: ${name}() operation must follow output type selection`
          );
        }
      }

      // Compensate for https://github.com/lovell/sharp/issues/276
      if (name === 'extract' && args.length >= 4) {
        args = [
          {
            left: args[0],
            top: args[1],
            width: args[2],
            height: args[3],
          },
        ];
      }

      operationsForExecution.push({ name, args });
    });

    // ensure at least one option is present
    options = { failOnError, ...options };

    if (pipeline.options.maxInputPixels) {
      options.limitInputPixels = pipeline.options.maxInputPixels;
    }

    const sharpInstance = module.exports.library(options);

    operationsForExecution.map(({ name, args }) =>
      sharpInstance[name](...args)
    );

    pipeline._attach(sharpInstance);

    return operationsForExecution;
  },
};
