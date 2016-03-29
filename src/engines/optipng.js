var requireOr = require('require-or');
var OptiPng = requireOr('optipng');

module.exports = {
    name: 'optipng',
    unavailable: !OptiPng,
    inputTypes: [ 'png' ],
    outputTypes: [ 'png' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new OptiPng(options));
    }
};
