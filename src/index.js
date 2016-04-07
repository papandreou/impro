var Impro = require('./Impro');

module.exports = new Impro()
    .use(require('./engines/gifsicle'))
    .use(require('./engines/sharp'))
    .use(require('./engines/metadata'))
    .use(require('./engines/inkscape'))
    .use(require('./engines/jpegtran'))
    .use(require('./engines/optipng'))
    .use(require('./engines/pngquant'))
    .use(require('./engines/pngcrush'))
    .use(require('./engines/svgfilter'))
    .use(require('./engines/gm'));

module.exports.Impro = Impro;
