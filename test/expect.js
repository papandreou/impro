const expectWithPlugins = require('unexpected')
  .clone()
  .use(require('unexpected-dom'))
  .use(require('unexpected-sinon'));
const sharp = require('sharp');

expectWithPlugins.addAssertion(
  '<string|Buffer|Uint8Array> to have metadata satisfying <any>',
  function (expect, subject) {
    // ...
    const extraArgs = Array.prototype.slice.call(arguments, 2);
    this.errorMode = 'nested';

    if (typeof subject === 'string') {
      const matchDataUrl = subject.match(/^data:[^;]*;base64,(.*)$/);
      if (matchDataUrl) {
        subject = Buffer.from(matchDataUrl[1], 'base64');
      }
    } else if (subject instanceof Uint8Array) {
      subject = Buffer.from(subject);
    }

    const that = this;

    return expect.promise((resolve, reject) => {
      sharp(subject).metadata((err, metadata) => {
        if (err) return reject(err);

        metadata = {
          ...metadata,
          format: metadata.format.toUpperCase(),
          size: {
            width: metadata.width,
            height: metadata.height,
          },
        };

        expect
          .promise(() => {
            that.errorMode = 'default';
            return expect.apply(
              expect,
              [metadata, 'to satisfy assertion'].concat(extraArgs)
            );
          })
          .caught(reject)
          .then(resolve);
      });
    });
  }
);

module.exports = expectWithPlugins;
