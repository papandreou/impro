const Impro = require('./Impro');
const engines = require('./engines/');

module.exports = new Impro()
  .use(engines.gifsicle)
  .use(engines.sharp)
  .use(engines.metadata)
  .use(engines.inkscape)
  .use(engines.jpegtran)
  .use(engines.optipng)
  .use(engines.pngquant)
  .use(engines.pngcrush)
  .use(engines.svgfilter)
  .use(engines.gm);

module.exports.Impro = Impro;
module.exports.engines = engines;
module.exports.queryString = require('./queryString');
