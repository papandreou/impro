const Stream = require('stream');

const errors = require('../errors');
const requireOr = require('../requireOr');

const gm = requireOr('gm-papandreou');

function createGmOperations(pipeline, operations) {
  const gmOperations = [];
  let resize;
  let crop;
  let withoutEnlargement;
  let ignoreAspectRatio;

  for (const requestedOperation of operations) {
    const operation = Object.assign({}, requestedOperation);

    if (operation.name === 'resize') {
      resize = operation;
    } else if (operation.name === 'crop') {
      crop = operation;
    } else if (operation.name === 'withoutEnlargement') {
      withoutEnlargement = operation;
      continue;
    } else if (operation.name === 'ignoreAspectRatio') {
      ignoreAspectRatio = operation;
      continue;
    }

    if (operation.name === 'rotate' && operation.args.length === 1) {
      operation.args = ['transparent', operation.args[0]];
    } else if (operation.name === 'resize') {
      const args = operation.args;
      if (typeof pipeline.options.maxOutputPixels === 'number') {
        const maxOutputPixels = pipeline.options.maxOutputPixels;

        if (args[0] * args[1] > maxOutputPixels) {
          throw new errors.OutputDimensionsExceeded(
            'resize: Target dimensions of ' +
              args[0] +
              'x' +
              args[1] +
              ' exceed maxOutputPixels (' +
              pipeline.options.maxOutputPixels +
              ')'
          );
        }

        if (args[0] === null && args[1] !== null) {
          args[0] = Math.floor(maxOutputPixels / args[1]);
        } else if (args[1] === null && args[0] !== null) {
          args[1] = Math.floor(maxOutputPixels / args[0]);
        }
      }
      operation.args = args.map((arg) => arg || '');
    } else if (operation.name === 'extract') {
      operation.name = 'crop';
      operation.args = [
        operation.args[2],
        operation.args[3],
        operation.args[0],
        operation.args[1],
      ];
    } else if (operation.name === 'crop') {
      operation.name = 'gravity';
      operation.args = [
        {
          northwest: 'NorthWest',
          north: 'North',
          northeast: 'NorthEast',
          west: 'West',
          center: 'Center',
          east: 'East',
          southwest: 'SouthWest',
          south: 'South',
          southeast: 'SouthEast',
        }[String(operation.args[0]).toLowerCase()] || 'Center',
      ];
    }
    if (operation.name === 'progressive') {
      operation.name = 'interlace';
      operation.args = ['line'];
    }
    // There are many, many more that could be supported:
    if (module.exports.outputTypes.includes(operation.name)) {
      operation.args.unshift(operation.name);
      operation.name = 'setFormat';
    }

    gmOperations.push(operation);
  }
  if (withoutEnlargement && resize) {
    resize.args[2] = '>';
  }
  if (ignoreAspectRatio && resize) {
    resize.args[2] = '!';
  }
  if (resize && crop) {
    gmOperations.push({
      name: 'extent',
      args: [].concat(resize.args),
    });
    resize.args[2] = '^';
  }

  return gmOperations;
}

function isNumberWithin(num, min, max) {
  return typeof num === 'number' && num >= min && num <= max;
}

const maxDimension = 16384;

module.exports = {
  name: 'gm',
  unavailable: !gm,
  operations: !gm
    ? []
    : [
        'extract',
        'progressive',
        'withoutEnlargement',
        'ignoreAspectRatio',
      ].concat(
        Object.keys(gm.prototype).filter(
          (propertyName) =>
            !/^_|^(?:name|emit|.*Listeners?|on|once|size|orientation|format|depth|color|res|filesize|identity|write|stream|type|setmoc)$/.test(
              propertyName
            ) && typeof gm.prototype[propertyName] === 'function'
        )
      ),
  inputTypes: ['gif', 'jpeg', 'png', 'ico', 'tga', 'tiff', '*'],
  outputTypes: ['gif', 'jpeg', 'png', 'tga', 'tiff', 'webp'],
  validateOperation: function (name, args) {
    switch (name) {
      // Operations that emulate sharp's API:
      case 'withoutEnlargement':
      case 'ignoreAspectRatio':
      case 'progressive':
        return args.length === 0;
      case 'crop':
        return (
          args.length === 1 &&
          /^(?:east|west|center|north(?:|west|east)|south(?:|west|east))/.test(
            args[0]
          )
        );
      case 'rotate':
        return (
          args.length === 0 ||
          (args.length === 1 &&
            (args[0] === 0 ||
              args[0] === 90 ||
              args[0] === 180 ||
              args[0] === 270))
        );
      case 'resize':
        return (
          args.length === 2 &&
          (args[0] === null || isNumberWithin(args[0], 1, maxDimension)) &&
          (args[1] === null || isNumberWithin(args[1], 1, maxDimension))
        );
      case 'extract':
        return (
          args.length === 4 &&
          isNumberWithin(args[0], 0, maxDimension - 1) &&
          isNumberWithin(args[1], 0, maxDimension - 1) &&
          isNumberWithin(args[2], 1, maxDimension) &&
          isNumberWithin(args[3], 1, maxDimension)
        );
      case 'quality':
        return args.length === 1 && isNumberWithin(args[0], 1, 100);
    }
  },
  execute: function (pipeline, operations) {
    const gmOperations = createGmOperations(pipeline, operations);

    // For some reason the gm module doesn't expose itself as a readable/writable stream,
    // so we need to wrap it into one:
    const readStream = new Stream();
    readStream.readable = true;

    const readWriteStream = new Stream();
    readWriteStream.readable = readWriteStream.writable = true;
    let spawned = false;
    readWriteStream.write = (chunk) => {
      if (!spawned) {
        spawned = true;
        let seenData = false;
        let hasEnded = false;
        const gmInstance = gm(
          readStream,
          pipeline.sourceType && `.${pipeline.sourceType}`
        );
        if (pipeline.options.maxInputPixels) {
          gmInstance.limit('pixels', pipeline.options.maxInputPixels);
        }

        const handleError = (err) => {
          hasEnded = true;
          err.commandArgs = gmInstance.args();
          readWriteStream.emit('error', err);
        };

        gmOperations
          .reduce((gmInstance, operation) => {
            if (typeof gmInstance[operation.name] === 'function') {
              return gmInstance[operation.name](...operation.args);
            } else {
              return gmInstance;
            }
          }, gmInstance)
          .stream((err, stdout, stderr) => {
            if (err) {
              return handleError(err);
            }

            stdout
              .on('data', (chunk) => {
                seenData = true;
                readWriteStream.emit('data', chunk);
              })
              .on('end', () => {
                if (!hasEnded) {
                  if (!seenData) {
                    return handleError(
                      new Error('gm: stream ended without emitting any data')
                    );
                  }

                  hasEnded = true;
                  readWriteStream.emit('end');
                }
              });
          });
      }
      readStream.emit('data', chunk);
    };
    readWriteStream.end = (chunk) => {
      if (chunk) {
        readWriteStream.write(chunk);
      }
      readStream.emit('end');
    };
    pipeline._attach(readWriteStream);

    return gmOperations;
  },
};
