var requireOr = require('require-or');
var JpegTran = requireOr('jpegtran');

module.exports = {
    name: 'jpegtran',
    unavailable: !JpegTran,
    inputTypes: [ 'jpeg' ],
    outputTypes: [ 'jpeg' ],
    execute: function (pipeline, operations, options) {
        pipeline.add(new JpegTran(options));
    }
};
