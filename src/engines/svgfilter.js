const requireOr = require('../requireOr');

const SvgFilter = requireOr('svgfilter');

module.exports = {
  name: 'svgfilter',
  unavailable: !SvgFilter,
  inputTypes: ['svg'],
  outputTypes: ['svg'],
  validateOperation: function (name, args) {
    // FIXME: This allows arbitrary arguments. Tighten up and expose a finite set of operations.
    return name === 'svgfilter';
  },
  execute: function (pipeline, operations, options) {
    options = options ? { ...options } : {};

    if (pipeline.options.svgAssetPath) {
      const url = `file://${pipeline.options.svgAssetPath}`;
      options.url = url;
      options.root = url; // required in SvgFilter for assetgraph
    }

    pipeline._attach(new SvgFilter(options));
  },
};
