const requireOr = require('../requireOr');

const Inkscape = requireOr('inkscape');

module.exports = {
  name: 'inkscape',
  unavailable: !Inkscape,
  inputTypes: ['svg'],
  defaultOutputType: 'png',
  outputTypes: ['pdf', 'eps', 'png'],
  validateOperation: function (name, args) {
    return args.length === 0;
  },
  execute: function (pipeline, operations, options) {
    const outputFormat =
      operations.length > 0 ? operations[operations.length - 1].name : 'png';
    const commandLineArgs =
      (operations[0] && operations[0].commandLineArgs) || [];
    if (!outputFormat || outputFormat === 'png') {
      pipeline.targetType = 'png';
      pipeline.targetContentType = 'image/png';
    }
    commandLineArgs.push(`--export-type=${outputFormat}`);
    pipeline._attach(new Inkscape(commandLineArgs));
  },
};
