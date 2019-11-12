const requireOr = require('require-or');
const sharp = requireOr('sharp');
const Stream = require('stream');
const createAnimatedGifDetector = requireOr('animated-gif-detector');
const mime = require('mime');
const exifReader = require('exif-reader');
const icc = require('icc');
const _ = require('lodash');

module.exports = {
  name: 'metadata',
  unavailable: !sharp,
  inputTypes: ['*'],
  defaultOutputType: 'json',
  outputTypes: ['json'],
  validateOperation: function(name, args) {
    return (
      (name === 'metadata' && args.length === 0) ||
      (args.length === 1 && args[0] === true)
    );
  },
  execute: function(pipeline, operations, options) {
    options = options || {};
    var impro = pipeline.impro;
    var cache = pipeline.options.sharpCache || options.cache;
    // Would make sense to move the _sharpCacheSet property to the type, but that breaks some test scenarios:
    if (cache !== 'undefined' && !impro._sharpCacheSet) {
      sharp.cache(cache);
      impro._sharpCacheSet = true;
    }
    var sharpInstance = sharp();
    var duplexStream = new Stream.Duplex();
    var animatedGifDetector;
    var isAnimated;
    if (
      (pipeline.targetType === 'gif' || !pipeline.targetType) &&
      createAnimatedGifDetector
    ) {
      animatedGifDetector = createAnimatedGifDetector();
      animatedGifDetector.on('animated', function() {
        isAnimated = true;
        this.emit('decided');
        animatedGifDetector = null;
      });

      duplexStream.on('finish', function() {
        if (typeof isAnimated === 'undefined') {
          isAnimated = false;
          if (animatedGifDetector) {
            animatedGifDetector.emit('decided', false);
            animatedGifDetector = null;
          }
        }
      });
    }
    duplexStream._write = function(chunk, encoding, cb) {
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
    var alreadyKnownMetadata = {
      format: pipeline.targetType,
      contentType: pipeline.targetContentType || mime.types[pipeline.targetType]
    };
    if (pipeline._streams.length === 0) {
      _.extend(alreadyKnownMetadata, pipeline.sourceMetadata);
    }
    duplexStream._read = function(size) {
      sharpInstance.metadata(function(err, metadata) {
        if (err) {
          metadata = _.defaults({ error: err.message }, alreadyKnownMetadata);
        }
        if (metadata.format === 'magick') {
          // https://github.com/lovell/sharp/issues/377
          metadata.format = undefined;
        } else if (metadata.format) {
          // metadata.format is one of 'jpeg', 'png', 'webp' so this should be safe:
          metadata.contentType = 'image/' + metadata.format;
        }
        _.defaults(metadata, alreadyKnownMetadata);
        if (metadata.exif) {
          var exifData;
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
            _.defaults(metadata, exifData);
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
          animatedGifDetector.on('decided', function(isAnimated) {
            metadata.animated = isAnimated;
            proceed();
          });
        } else {
          proceed();
        }
      });
    };
    duplexStream.on('finish', function() {
      sharpInstance.end();
    });
    pipeline._attach(duplexStream);
    pipeline.targetType = 'json';
    pipeline.targetContentType = 'application/json; charset=utf-8';
  }
};
