var requireOr = require('require-or');
var PngQuant = requireOr('pngquant');

module.exports = {
    name: 'pngquant',
    unavailable: !PngQuant,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new PngQuant(options));
    }
};
