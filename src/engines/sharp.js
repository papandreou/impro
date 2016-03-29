var requireOr = require('require-or');
var sharp = requireOr('sharp');
var errors = require('../errors');

module.exports = {
    name: 'sharp',
    unavailable: !sharp,
    operations: ['resize', 'extract', 'sequentialRead', 'crop', 'max', 'background', 'embed', 'flatten', 'rotate', 'flip', 'flop', 'withoutEnlargement', 'ignoreAspectRatio', 'sharpen', 'interpolateWith', 'gamma', 'grayscale', 'greyscale', 'quality', 'progressive', 'withMetadata', 'compressionLevel'],
    inputTypes: [ 'jpeg', 'png', 'webp', '*' ],
    outputTypes: [ 'jpeg', 'png', 'webp' ],
    execute: function (pipeline, operations, options) {
        var impro = pipeline.impro;
        // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
        if (impro.sharp && typeof impro.sharp.cache !== 'undefined' && !impro._sharpCacheSet) {
            sharp.cache(impro.sharp.cache);
            impro._sharpCacheSet = true;
        }
        var sharpInstance = sharp();
        if (impro.maxInputPixels) {
            sharpInstance = sharpInstance.limitInputPixels(impro.maxInputPixels);
        }
        operations.forEach(function (operation) {
            var args = operation.args;
            if (operation.name === 'resize' && typeof impro.maxOutputPixels === 'number' && args[0] * args[1] > impro.maxOutputPixels) {
                throw new errors.OutputDimensionsExceeded('resize: Target dimensions of ' + args[0] + 'x' + args[1] + ' exceed maxOutputPixels (' + impro.maxOutputPixels + ')');
            }
            // Compensate for https://github.com/lovell/sharp/issues/276
            if (operation.name === 'extract' && args.length >= 4) {
                args = [ { left: args[0], top: args[1], width: args[2], height: args[3] } ];
            }
            return sharpInstance[operation.name](...args);
        });
        pipeline.add(sharpInstance);
    }
};
