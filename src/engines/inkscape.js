const requireOr = require('require-or');
const Inkscape = requireOr('inkscape');

module.exports = {
  name: 'inkscape',
  unavailable: !Inkscape,
  inputTypes: ['svg'],
  defaultOutputType: 'png',
  outputTypes: ['pdf', 'eps', 'png'],
  validateOperation: function(name, args) {
    return args.length === 0;
  },
  execute: function(pipeline, operations, options) {
    var outputFormat =
      operations.length > 0 ? operations[operations.length - 1].name : 'png';
    var commandLineArgs =
      (operations[0] && operations[0].commandLineArgs) || [];
    if (outputFormat === 'pdf') {
      commandLineArgs.push('--export-pdf');
    } else if (outputFormat === 'eps') {
      commandLineArgs.push('--export-eps');
    } else if (!outputFormat || outputFormat === 'png') {
      pipeline.targetType = 'png';
      pipeline.targetContentType = 'image/png';
      commandLineArgs.push('--export-png');
    }
    pipeline._attach(new Inkscape(commandLineArgs));
  }
};
