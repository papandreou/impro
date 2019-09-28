const requireOr = require('require-or');
const sharp = requireOr('sharp');
const errors = require('../errors');

function isNumberWithin(num, min, max) {
    return typeof num === 'number' && num >= min && num <= max;
}

function locatePreviousCommand(operations, nameToFind) {
    return operations.findIndex(operation => {
        return operation.name === nameToFind;
    });
}

function patchPreviousCommandArgument(operation, argUpdates, indexInArg) {
    operation = { ...operation };
    operation.args = [...operation.args];
    operation.args[indexInArg] = {
        ...operation.args[indexInArg],
        ...argUpdates
    };
    return operation;
}

const maxDimension = 16384;
const optionsToResize = {
    withoutEnlargement: () => ({ fit: 'inside' }),
    ignoreAspectRatio: () => ({ fit: 'fill' })
};

module.exports = {
    name: 'sharp',
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
        'optimiseScans'
    ],
    inputTypes: ['jpeg', 'png', 'webp', 'svg', 'tiff', '*'],
    outputTypes: ['jpeg', 'png', 'webp', 'tiff', 'dzi'],
    validateOperation: function(name, args) {
        switch (name) {
            case 'crop':
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
                    isNumberWithin(args[0], 1, maxDimension) &&
                    isNumberWithin(args[1], 1, maxDimension)
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
                    (typeof args[0] === 'undefined' ||
                        typeof args[0] === 'number') &&
                    (typeof args[1] === 'undefined' ||
                        typeof args[1] === 'number') &&
                    (typeof args[2] === 'undefined' ||
                        typeof args[2] === 'number')
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
                    (typeof args[1] === 'undefined' ||
                        isNumberWithin(args[0], 0, 8192))
                );
            case 'compressionLevel':
                return args.length === 1 && isNumberWithin(args[0], 0, 9);
        }
    },
    execute: function(pipeline, operations, options) {
        options = options || {};
        var impro = pipeline.impro;
        // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
        if (options.cache !== 'undefined' && !impro._sharpCacheSet) {
            sharp.cache(options.cache);
            impro._sharpCacheSet = true;
        }
        var sharpInstance = sharp();
        if (pipeline.options.maxInputPixels) {
            sharpInstance = sharpInstance.limitInputPixels(
                pipeline.options.maxInputPixels
            );
        }
        if (options.sequentialRead) {
            sharpInstance = sharpInstance.sequentialRead();
        }

        var operationsForExecution = [];

        if (pipeline.targetType) {
            operationsForExecution.push({
                name: pipeline.targetType,
                args: []
            });
        }

        operations.forEach(function(operation) {
            var name = operation.name;
            var args = operation.args;
            if (
                operation.name === 'resize' &&
                typeof pipeline.options.maxOutputPixels === 'number' &&
                args[0] * args[1] > pipeline.options.maxOutputPixels
            ) {
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
            // in sharp crop is implemented as options to resize
            if (operation.name === 'crop') {
                const locatedIndex = locatePreviousCommand(
                    operationsForExecution,
                    'resize'
                );
                if (locatedIndex > -1) {
                    const locatedOperation = patchPreviousCommandArgument(
                        operationsForExecution[locatedIndex],
                        { fit: 'cover', position: args[0] },
                        2
                    );
                    operationsForExecution[locatedIndex] = locatedOperation;
                    return;
                } else {
                    name = 'resize';
                    args = [null, null, { fit: 'cover', position: args[0] }];
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

            // in sharp quality is implemented as an option to the target type
            if (operation.name === 'quality') {
                const locatedIndex = locatePreviousCommand(
                    operationsForExecution,
                    pipeline.targetType
                );
                if (locatedIndex > -1) {
                    const locatedOperation = patchPreviousCommandArgument(
                        operationsForExecution[locatedIndex],
                        { quality: args[0] },
                        0
                    );
                    operationsForExecution[locatedIndex] = locatedOperation;
                    return;
                } else {
                    throw new Error(
                        'sharp: quality() operation must follow output type selection'
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
                        height: args[3]
                    }
                ];
            }

            operationsForExecution.push({ name, args });
        });

        operationsForExecution.map(({ name, args }) =>
            sharpInstance[name](...args)
        );

        pipeline._attach(sharpInstance);

        return operationsForExecution;
    }
};
