const Stream = require('stream');
const exifReader = require('exif-reader');
const icc = require('icc');

const mime = require('../mime');
const requireOr = require('../requireOr');

const createAnimatedGifDetector = requireOr('animated-gif-detector');
const sharp = requireOr('sharp');

function defaultProperties(obj, source) {
  for (const key in source) {
    if (typeof obj[key] === 'undefined') {
      obj[key] = source[key];
    }
  }
  return obj;
}

module.exports = {
  name: 'metadata',
  unavailable: !sharp,
  inputTypes: ['*'],
  defaultOutputType: 'json',
  outputTypes: ['json'],
  validateOperation: function (name, args) {
    return (
      (name === 'metadata' && args.length === 0) ||
      (args.length === 1 && args[0] === true)
    );
  },
  execute: function (pipeline, operations, options) {
    options = options || {};
    const impro = pipeline.impro;
    const cache = pipeline.options.sharpCache || options.cache;
    // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
    if (cache !== 'undefined' && !impro._sharpCacheSet) {
      sharp.cache(cache);
      impro._sharpCacheSet = true;
    }
    const sharpInstance = sharp();
    const duplexStream = new Stream.Duplex();
    let animatedGifDetector;
    let isAnimated;
    if (
      (pipeline.targetType === 'gif' || !pipeline.targetType) &&
      createAnimatedGifDetector
    ) {
      animatedGifDetector = createAnimatedGifDetector();
      animatedGifDetector.on('animated', function () {
        isAnimated = true;
        this.emit('decided');
        animatedGifDetector = null;
      });

      duplexStream.on('finish', () => {
        if (typeof isAnimated === 'undefined') {
          isAnimated = false;
          if (animatedGifDetector) {
            animatedGifDetector.emit('decided', false);
            animatedGifDetector = null;
          }
        }
      });
    }
    duplexStream._write = (chunk, encoding, cb) => {
      if (animatedGifDetector) {
        animatedGifDetector.write(chunk);
      }
      if (
        sharpInstance.write(chunk, encoding) === false &&
        !animatedGifDetector
      ) {
        sharpInstance.once('drain', cb);
      } else {
        cb();
      }
    };
    const alreadyKnownMetadata = {
      format: pipeline.targetType,
      contentType:
        pipeline.targetContentType || mime.getType(pipeline.targetType),
    };
    if (pipeline._streams.length === 0) {
      Object.assign(alreadyKnownMetadata, pipeline.sourceMetadata);
    }
    duplexStream._read = (size) => {
      sharpInstance.metadata((err, metadata) => {
        if (err) {
          metadata = { error: err.message };
        }
        if (metadata.format === 'magick') {
          // https://github.com/lovell/sharp/issues/377
          metadata.format = undefined;
        } else if (metadata.format) {
          // metadata.format is one of 'jpeg', 'png', 'webp' so this should be safe:
          metadata.contentType = 'image/' + metadata.format;
        }
        defaultProperties(metadata, alreadyKnownMetadata);
        if (metadata.exif) {
          let exifData;
          try {
            exifData = exifReader(metadata.exif);
          } catch (e) {
            // Error: Invalid EXIF
          }
          metadata.exif = undefined;
          if (exifData) {
            const orientation = exifData.image && exifData.image.Orientation;
            // Check if the image.Orientation EXIF tag specifies says that the
            // width and height are to be flipped
            // http://sylvana.net/jpegcrop/exif_orientation.html
            if (
              typeof orientation === 'number' &&
              orientation >= 5 &&
              orientation <= 8
            ) {
              metadata.orientedWidth = metadata.height;
              metadata.orientedHeight = metadata.width;
            } else {
              metadata.orientedWidth = metadata.width;
              metadata.orientedHeight = metadata.height;
            }
            defaultProperties(metadata, exifData);
          }
        }
        if (metadata.icc) {
          try {
            metadata.icc = icc.parse(metadata.icc);
          } catch (e) {
            // Error: Error: Invalid ICC profile, remove the Buffer
            metadata.icc = undefined;
          }
        }
        function proceed() {
          duplexStream.push(JSON.stringify(metadata));
          duplexStream.push(null);
        }
        if (typeof isAnimated === 'boolean') {
          metadata.animated = isAnimated;
          proceed();
        } else if (animatedGifDetector) {
          animatedGifDetector.on('decided', (isAnimated) => {
            metadata.animated = isAnimated;
            proceed();
          });
        } else {
          proceed();
        }
      });
    };
    duplexStream.on('finish', () => {
      sharpInstance.end();
    });
    pipeline._attach(duplexStream);
    pipeline.targetType = 'json';
    pipeline.targetContentType = 'application/json; charset=utf-8';
  },
};
