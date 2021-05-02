module.exports = require('unexpected')
  .clone()
  .use(require('unexpected-dom'))
  .use(require('unexpected-image'))
  .use(require('unexpected-sinon'))
  .use(require('unexpected-resemble'));
