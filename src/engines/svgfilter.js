const requireOr = require('require-or');
const SvgFilter = requireOr('svgfilter');

module.exports = {
  name: 'svgfilter',
  unavailable: !SvgFilter,
  inputTypes: ['svg'],
  outputTypes: ['svg'],
  validateOperation: function(name, args) {
    // FIXME: This allows arbitrary arguments. Tighten up and expose a finite set of operations.
    return name === 'svgfilter';
  },
  execute: function(pipeline, operations, options) {
    pipeline._attach(new SvgFilter(options));
  }
};
