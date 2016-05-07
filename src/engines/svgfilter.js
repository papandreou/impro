var requireOr = require('require-or');
var SvgFilter = requireOr('svgfilter');

module.exports = {
    name: 'svgfilter',
    unavailable: !SvgFilter,
    inputTypes: [ 'svg' ],
    outputTypes: [ 'svg' ],
    inputMedia: [ 'stream' ],
    outputMedia: [ 'stream' ],
    validateOperation: function (name, args) {
        // FIXME: This allows arbitrary arguments. Tighten up and expose a finite set of operations.
        return name === 'svgfilter';
    },
    execute: function (pipeline, operations, options) {
        pipeline.add(new SvgFilter(options));
    }
};
