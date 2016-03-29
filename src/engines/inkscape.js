var requireOr = require('require-or');
var Inkscape = requireOr('inkscape');

module.exports = {
    name: 'inkscape',
    unavailable: !Inkscape,
    inputTypes: [ 'svg' ],
    defaultOutputType: 'png',
    outputTypes: [ 'pdf', 'eps', 'png' ],
    execute: function (pipeline, operations, options) {
        var outputFormat = operations.length > 0 ? operations[operations.length - 1].name : 'png';
        var args = (operations[0] && operations[0].args) || [];
        if (outputFormat === 'pdf') {
            args.push('--export-pdf');
        } else if (outputFormat === 'eps') {
            args.push('--export-eps');
        } else if (!outputFormat || outputFormat === 'png') {
            pipeline.targetType = 'png';
            pipeline.targetContentType = 'image/png';
            args.push('--export-png');
        }
        pipeline.add(new Inkscape(args));
    }
};
