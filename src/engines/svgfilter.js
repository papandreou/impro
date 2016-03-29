var requireOr = require('require-or');
var SvgFilter = requireOr('svgfilter');

module.exports = {
    name: 'svgfilter',
    unavailable: !SvgFilter,
    inputTypes: [ 'svg' ],
    outputTypes: [ 'svg' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new SvgFilter(options[0]));
    }
};
