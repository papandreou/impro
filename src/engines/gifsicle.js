var requireOr = require('require-or');
var Gifsicle = requireOr('gifsicle-stream');

module.exports = {
    name: 'gifsicle',
    unavailable: !Gifsicle,
    operations: [ 'crop', 'rotate', 'progressive', 'extract', 'resize', 'ignoreAspectRatio', 'withoutEnlargement' ],
    inputTypes: [ 'gif' ],
    outputTypes: [ 'gif' ],
    execute: function (pipeline, operations) {
        var gifsicleArgs = [];
        var seenOperationThatMustComeBeforeExtract = false;
        function flush()  {
            if (gifsicleArgs.length > 0) {
                pipeline.add(new Gifsicle(gifsicleArgs));
                seenOperationThatMustComeBeforeExtract = false;
                gifsicleArgs = [];
            }
        };

        var ignoreAspectRatio = operations.some(function (operation) {
            return operation.name === 'ignoreAspectRatio';
        });

        operations.forEach(function (operation) {
            if (operation.name === 'resize') {
                seenOperationThatMustComeBeforeExtract = true;
                gifsicleArgs.push('--resize' + (ignoreAspectRatio ? '' : '-fit'), operation.args[0] + 'x' + operation.args[1]);
            } else if (operation.name === 'extract') {
                if (seenOperationThatMustComeBeforeExtract) {
                    flush();
                }
                gifsicleArgs.push('--crop', operation.args[0] + ',' + operation.args[1] + '+' + operation.args[2] + 'x' + operation.args[3]);
            } else if (operation.name === 'rotate' && /^(?:90|180|270)$/.test(operation.args[0])) {
                gifsicleArgs.push('--rotate-' + operation.args[0]);
                seenOperationThatMustComeBeforeExtract = true;
            } else if (operation.name === 'progressive') {
                gifsicleArgs.push('--interlace');
            }
        }, this);
        flush();
        pipeline.targetType = 'gif';
        pipeline.targetContentType = 'image/gif';
    }
};
