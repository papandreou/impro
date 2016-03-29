var requireOr = require('require-or');
var PngCrush = requireOr('pngcrush');

module.exports = {
    name: 'pngcrush',
    unavailable: !PngCrush,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new PngCrush(options));
    }
};
