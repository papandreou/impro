const expect = require('./expect');

const childProcess = require('child_process');
const fileType = require('file-type');
const sinon = require('sinon');
const stream = require('stream');

const impro = require('../');
const Pipeline = require('../src/Pipeline');

const memoizeSync = require('memoizesync');
const pathModule = require('path');
const fs = require('fs');

const testDataPath = pathModule.resolve(__dirname, '..', 'testdata');

const consumeStream = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream
      .on('error', (e) => reject(e))
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
};

const fileNameForPlatform = (fileName, platformsToOverride) => {
  if (
    Array.isArray(platformsToOverride) &&
    platformsToOverride.includes(process.platform)
  ) {
    const ext = pathModule.extname(fileName);
    return [
      pathModule.basename(fileName, ext),
      '-',
      process.platform,
      ext,
    ].join('');
  }

  return fileName;
};

const load = memoizeSync((fileName) =>
  fs.readFileSync(pathModule.resolve(__dirname, '..', 'testdata', fileName))
);

const loadAsStream = (fileName) =>
  fs.createReadStream(
    pathModule.resolve(__dirname, '..', 'testdata', fileName)
  );

expect.addType({
  name: 'Pipeline',
  base: 'object',
  getKeys() {
    return ['options', 'isDisabledByEngineName', 'usedEngines'];
  },
  identify(obj) {
    return obj instanceof Pipeline;
  },
  prefix(output) {
    return output.jsKeyword('Pipeline').text('({');
  },
  suffix(output) {
    return output.text('})');
  },
});

expect.addAssertion(
  '<string> when piped through <Pipeline> <assertion?>',
  async (expect, subject, pipeline, ...rest) => {
    expect.errorMode = 'nested';

    loadAsStream(subject).pipe(pipeline);

    return expect(pipeline, ...rest);
  }
);

expect.addAssertion(
  '<Buffer> to have mime type <string>',
  (expect, subject, value) => {
    expect.errorMode = 'nested';
    return expect(fileType(subject).mime, 'to equal', value);
  }
);

expect.addAssertion(
  '<Pipeline> to yield output satisfying <any>',
  async (expect, subject, value) =>
    expect(
      await consumeStream(subject),
      'when decoded as',
      'utf-8',
      'when passed as parameter to',
      JSON.parse,
      'to satisfy',
      value
    )
);

expect.addAssertion(
  '<Pipeline> to yield output satisfying <assertion>',
  async (expect, subject, ...rest) =>
    expect(await consumeStream(subject), ...rest)
);

expect.addAssertion(
  '<Pipeline> to error with <string>',
  async (expect, subject, value) => {
    expect.errorMode = 'bubble';

    try {
      await consumeStream(subject);
    } catch (e) {
      return expect(e, 'to have message', value);
    }

    expect.fail('Pipeline did not error');
  }
);

expect.addAssertion(
  '<Pipeline> to error with <Error|expect.it>',
  async (expect, subject, value) => {
    expect.errorMode = 'bubble';

    try {
      await consumeStream(subject);
    } catch (e) {
      return expect(e, 'to satisfy', value);
    }

    expect.fail('Pipeline did not error');
  }
);

describe('impro', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should be an instance of impro.Impro', () => {
    expect(impro, 'to be an', impro.Impro);
  });

  it('should allow instantiation with an object', () => {
    expect(new impro.Impro({}), 'to be an', impro.Impro);
  });

  it('should throw on invalid options', () => {
    expect(() => new impro.Impro('foo'), 'to throw', 'invalid options');
  });

  it('should allow an image engine to be explicitly selected', () =>
    expect(
      'turtle.jpg',
      'when piped through',
      impro.gm().resize(40, 15).crop('center'),
      'to yield output satisfying to resemble',
      load(fileNameForPlatform('turtleCroppedCenterGm.jpg', ['darwin']))
    ));

  it('should maintain an array of engines that have been applied', () =>
    expect(
      impro.sharp().resize(10, 10).gm().extract(10, 20, 30, 40).flush()
        .usedEngines,
      'to satisfy',
      [
        {
          name: 'sharp',
          operations: [{ name: 'resize', args: [10, 10] }],
        },
        {
          name: 'gm',
          operations: [{ name: 'extract', args: [10, 20, 30, 40] }],
        },
      ]
    ));

  it('should allow a type conversion', () =>
    expect(impro.png().flush().usedEngines, 'to satisfy', [
      {
        name: 'sharp',
        operations: [{ name: 'png', args: [] }],
      },
    ]));

  it('should allow multiple type conversions', () =>
    expect(
      impro.type('gif').resize(10, 10).png().quality(88).flush().usedEngines,
      'to satisfy',
      [
        {
          name: 'gifsicle',
          operations: [{ name: 'resize', args: [10, 10] }],
        },
        {
          name: 'sharp',
          operations: [
            { name: 'png', args: [] },
            { name: 'quality', args: [88], engineName: 'sharp' },
          ],
        },
      ]
    ));

  it('should not provide a targetContentType when no source content type is given and no explicit conversion has been performed', () =>
    expect(impro.resize(40, 15).crop('center'), 'to satisfy', {
      targetContentType: undefined,
    }));

  describe('when passed an object', () => {
    it('should interpret unsupported properties as source metadata', () => {
      expect(impro.source({ foo: 'bar' }).sourceMetadata, 'to equal', {
        foo: 'bar',
      });
    });

    it('should support a type property', () => {
      expect(impro.type('gif').targetContentType, 'to equal', 'image/gif');
    });

    it('should support a type property that is a full Content-Type', () => {
      expect(
        impro.type('image/gif').targetContentType,
        'to equal',
        'image/gif'
      );
    });
  });

  describe('#createPipeline', () => {
    it('should allow directly setting an output type option', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);
      const pipeline = customImpro.createPipeline({ type: 'gif' }).flush();

      expect(pipeline, 'to satisfy', {
        sourceType: 'gif',
        targetType: 'gif',
        targetContentType: 'image/gif',
      });
    });

    it('should process and execute instructions when passed an array of operation objects', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.createPipeline([
          { name: 'resize', args: [40, 15] },
          { name: 'crop', args: ['center'] },
        ]),
        'to yield output satisfying to resemble',
        load('turtleCroppedCenter.jpg')
      ));

    it('should throw if the operations definition is not supported', () =>
      expect(
        () => {
          impro.createPipeline({}, {});
        },
        'to throw',
        'Pipeline creation can only be supplied an operations array'
      ));

    it('should throw when flushing unsupported operations', () =>
      expect(
        () => {
          impro
            .createPipeline(null, [{ name: 'nonexistent', args: [] }])
            .flush();
        },
        'to throw',
        'No supported engine can carry out this sequence of operations'
      ));

    it('should throw early from the chaining interface on an unsupported operation', () =>
      expect(
        () => {
          impro.createPipeline({}).crop();
        },
        'to throw',
        'invalid operation or arguments: crop=[]'
      ));
  });

  describe('#getEngine', () => {
    it('should allow directly setting an output type option', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.getEngine('gifsicle'),
        'to equal',
        impro.engines.gifsicle
      );
    });

    it('should throw with an unsupported engine', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine('sharp'),
        'to throw error',
        'unknown engine sharp'
      );
    });

    it('should throw with no engine name', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine(),
        'to throw error',
        'unknown engine unknown'
      );
    });

    it('should throw with bad engine name', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine({}),
        'to throw error',
        'unknown engine unknown'
      );
    });
  });

  describe('#isOperationSupportedByEngine', () => {
    it('should return true for a supported operation', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.isOperationSupportedByEngine('crop', 'gifsicle'),
        'to be true'
      );
    });

    it('should return false for an unsupported operation', () => {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.isOperationSupportedByEngine('randomname', 'gifsicle'),
        'to be false'
      );
    });
  });

  describe('when adding the processing instructions via individual method calls', () => {
    it('should return a duplex stream that executes the processing instructions', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.resize(40, 15).crop('center'),
        'to yield output satisfying to resemble',
        load('turtleCroppedCenter.jpg')
      ));
  });

  describe('when given a source content type', () => {
    it('should default to output an image of the same type', () =>
      expect(
        impro.type('image/jpeg').resize(40, 15).crop('center'),
        'to satisfy',
        {
          targetContentType: 'image/jpeg',
        }
      ));

    it('should honor an explicit type conversion', () =>
      expect(impro.type('image/jpeg').gif().flush(), 'to satisfy', {
        targetType: 'gif',
        targetContentType: 'image/gif',
      }));
  });

  describe('#metadata', () => {
    it('should default the output content type to JSON', () =>
      expect(impro.metadata().flush(), 'to satisfy', {
        targetContentType: 'application/json; charset=utf-8',
      }));

    it('should produce the metadata of an image as JSON', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
          width: 481,
          height: 424,
          space: 'srgb',
          channels: 3,
          hasProfile: false,
          hasAlpha: false,
        }
      ));

    it('should include EXIF metadata in the output JSON', () =>
      expect(
        'exif.jpg',
        'when piped through',
        impro.metadata(),
        'to yield output satisfying',
        {
          image: expect.it('to exhaustively satisfy', {
            Make: 'Apple',
            Model: 'iPhone 6s',
            Orientation: 6,
            XResolution: 72,
            YResolution: 72,
            ResolutionUnit: 2,
            Software: '11.2',
            ModifyDate: expect.it('to be a string'),
            YCbCrPositioning: 1,
            ExifOffset: 192,
          }),
          // included due to the source image being rotated
          width: 4032,
          height: 3024,
          orientedWidth: 3024,
          orientedHeight: 4032,
        }
      ));

    it('should include source metadata provided via the meta method', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.source({ filesize: 105836, etag: 'W/"foobar"' }).metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: 105836,
          etag: /^W\//,
        }
      ));

    it('should include source metadata provided via the meta method when supplied as a pipeline option', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro
          .createPipeline({
            sourceMetadata: { filesize: 105836, etag: 'W/"foobar"' },
          })
          .metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: 105836,
          etag: 'W/"foobar"',
        }
      ));

    it('should not include source metadata provided via the meta method when an operation has been performed', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro
          .source({ filesize: 105836, etag: 'W/"foobar"' })
          .resize(10, 10)
          .embed('center')
          .metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: undefined,
          etag: undefined,
          width: 10,
          height: 10,
        }
      ));

    it('should allow retrieving the metadata for an image with a specified type', () =>
      expect(
        'exif.jpg',
        'when piped through',
        impro.type('image/jpeg').metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
        }
      ));

    it('should allow retrieving the metadata of a non-image file with a non-image extension', () =>
      expect(
        'something.txt',
        'when piped through',
        impro.type('text/plain; charset=UTF-8').metadata(),
        'to yield output satisfying',
        {
          error: 'Input buffer contains unsupported image format',
          contentType: 'text/plain; charset=UTF-8',
        }
      ));

    it('should set animated:true for an animated gif', () =>
      expect(
        'animated.gif',
        'when piped through',
        impro.metadata(),
        'to yield output satisfying',
        {
          animated: true,
        }
      ));

    it('should set animated:false for a non-animated gif', () =>
      expect(
        'bulb.gif',
        'when piped through',
        impro.metadata(),
        'to yield output satisfying',
        {
          animated: false,
        }
      ));

    it('should allow passing a cache option', function () {
      const cacheSpy = sinon.spy(require('sharp'), 'cache');
      const improInstance = new impro.Impro().use(impro.engines.metadata);
      return expect(
        'turtle.jpg',
        'when piped through',
        improInstance.metadata({ cache: 123 }),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
        }
      ).then(() => {
        expect(cacheSpy, 'to have calls satisfying', () => {
          cacheSpy(123);
        });
      });
    });

    it('should allow passing a sharpCache option to the pipeline', function () {
      const cacheSpy = sinon.spy(require('sharp'), 'cache');
      const improInstance = new impro.Impro().use(impro.engines.metadata);
      return expect(
        'turtle.jpg',
        'when piped through',
        improInstance.createPipeline({ sharpCache: 456 }).metadata(),
        'to yield output satisfying',
        {
          contentType: 'image/jpeg',
        }
      ).then(() => {
        expect(cacheSpy, 'to have calls satisfying', () => {
          cacheSpy(456);
        });
      });
    });
  });

  describe('with the sharp engine', () => {
    it('should allow passing a cache option', function () {
      const cacheSpy = sinon.spy(require('sharp'), 'cache');
      const improInstance = new impro.Impro().use(impro.engines.sharp);
      return expect(
        'turtle.jpg',
        'when piped through',
        improInstance.sharp({ cache: 123 }).resize(10, 10),
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
        }
      ).then(() => {
        expect(cacheSpy, 'to have calls satisfying', () => {
          cacheSpy(123);
        });
      });
    });

    it('should allow passing a sharpCache option to the pipeline', function () {
      const cacheSpy = sinon.spy(require('sharp'), 'cache');
      const improInstance = new impro.Impro().use(impro.engines.sharp);
      return expect(
        'turtle.jpg',
        'when piped through',
        improInstance.createPipeline({ sharpCache: 456 }).resize(10, 10),
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
        }
      ).then(() => {
        expect(cacheSpy, 'to have calls satisfying', () => {
          cacheSpy(456);
        });
      });
    });

    it('should allow passing a sequentialRead option', function () {
      const improInstance = new impro.Impro().use(impro.engines.sharp);
      const sharpSpy = sinon.spy(improInstance.getEngine('sharp'), 'library');
      const pipeline = improInstance
        .sharp({ sequentialRead: true })
        .type('jpeg')
        .resize(10, 10);

      return expect(
        'turtle.jpg',
        'when piped through',
        pipeline,
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
        }
      ).then(() => {
        expect(sharpSpy, 'to have calls satisfying', [
          [{ sequentialRead: true }],
        ]);
      });
    });

    it('should allow setting a input pixel limit', function () {
      const improInstance = new impro.Impro().use(impro.engines.sharp);
      const sharpSpy = sinon.spy(improInstance.getEngine('sharp'), 'library');
      const pipeline = improInstance
        .createPipeline({ maxInputPixels: 1000 })
        .type('jpeg')
        .resize(10, 10);

      return expect(
        'turtle.jpg',
        'when piped through',
        pipeline,
        'to error with',
        'Input image exceeds pixel limit'
      ).then(() => {
        expect(sharpSpy, 'to have calls satisfying', [
          [{ limitInputPixels: 1000 }],
        ]);
      });
    });

    it('should only call sharp.cache once, even after processing multiple images', function () {
      const cacheSpy = sinon.spy(require('sharp'), 'cache');
      const improInstance = new impro.Impro().use(impro.engines.sharp);
      return expect(
        'turtle.jpg',
        'when piped through',
        improInstance.sharp({ cache: 123 }).type('jpeg').resize(10, 10),
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
        }
      )
        .then(() =>
          expect(
            'turtle.jpg',
            'when piped through',
            impro.sharp({ cache: 123 }).type('jpeg').resize(10, 10),
            'to yield output satisfying to have metadata satisfying',
            {
              format: 'JPEG',
            }
          )
        )
        .then(() =>
          expect(cacheSpy, 'to have calls satisfying', () => cacheSpy(123))
        );
    });

    it('should support blur with no argument', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.type('jpg').blur().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'blur',
          args: [],
        },
      ]);
    });

    it('should support blur with an argument', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.type('jpg').blur(0.5).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'blur',
          args: [0.5],
        },
      ]);
    });

    it('should support quality', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      const usedEngines = impro.type('jpeg').quality(88).flush().usedEngines;

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'jpeg',
          args: [{ quality: 88 }],
        },
      ]).then(() =>
        // check that the external representation is unchanged
        expect(usedEngines, 'to satisfy', [
          {
            name: 'sharp',
            operations: expect.it('to equal', [
              {
                name: 'quality',
                args: [88],
                engineName: 'sharp',
              },
            ]),
          },
        ])
      );
    });

    it('should throw on quality without a target type', () =>
      expect(
        () => {
          impro.quality(88).flush();
        },
        'to throw',
        'sharp: quality() operation must follow output type selection'
      ));

    it('should support progressive', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.type('jpeg').progressive(),
        'to yield output satisfying to have metadata satisfying',
        {
          Interlace: 'Line',
        }
      ));

    it('should support rotate', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.type('jpg').rotate(90).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'rotate',
          args: [90],
        },
      ]);
    });

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.sharp().resize(10, null).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, null, { fit: 'inside' }] },
      ]);
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.sharp().resize(null, 10).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [null, 10, { fit: 'inside' }] },
      ]);
    });

    it('should support crop without resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('center').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'center' }],
        },
      ]);
    });

    it('should combine crop with a resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      const usedEngines = impro
        .type('jpg')
        .resize(10, 10)
        .crop('northwest')
        .flush().usedEngines;

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'cover', position: 'northwest' }],
        },
      ]).then(() =>
        // check that the external representation is unchanged
        expect(usedEngines, 'to satisfy', [
          {
            name: 'sharp',
            operations: expect.it('to equal', [
              {
                name: 'resize',
                args: [10, 10],
                engineName: 'sharp',
              },
              {
                name: 'crop',
                args: ['northwest'],
                engineName: 'sharp',
              },
            ]),
          },
        ])
      );
    });

    it('should support crop with "attention"', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('attention').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'attention' }],
        },
      ]);
    });

    it('should support crop with "entropy"', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('entropy').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'entropy' }],
        },
      ]);
    });

    it('should support embed without resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.embed('north').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'contain', position: 'north' }],
        },
      ]);
    });

    it('should combine embed with a resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      const usedEngines = impro
        .type('jpg')
        .resize(10, 10)
        .embed('northwest')
        .flush().usedEngines;

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'contain', position: 'northwest' }],
        },
      ]).then(() =>
        // check that the external representation is unchanged
        expect(usedEngines, 'to satisfy', [
          {
            name: 'sharp',
            operations: expect.it('to equal', [
              {
                name: 'resize',
                args: [10, 10],
                engineName: 'sharp',
              },
              {
                name: 'embed',
                args: ['northwest'],
                engineName: 'sharp',
              },
            ]),
          },
        ])
      );
    });

    it('should throw on withoutEnlargement without resize', () =>
      expect(
        () => {
          impro.withoutEnlargement().flush();
        },
        'to throw',
        'sharp: withoutEnlargement() operation must follow resize'
      ));

    it('should support withoutEnlargement', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.resize(10, 10).withoutEnlargement().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'inside', withoutEnlargement: true }],
        },
      ]);
    });

    it('should throw on ignoreAspectRatio without resize', () =>
      expect(
        () => {
          impro.ignoreAspectRatio().flush();
        },
        'to throw',
        'sharp: ignoreAspectRatio() operation must follow resize'
      ));

    it('should support ignoreAspectRatio', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.resize(10, 10).ignoreAspectRatio().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'fill' }],
        },
      ]);
    });

    describe('with a maxOutputPixels setting in place', () => {
      it('should support resize (only width)', () => {
        const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .sharp()
          .resize(2000, null)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          { name: 'resize', args: [2000, 12, { fit: 'inside' }] },
        ]);
      });

      it('should support resize (only height)', () => {
        const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .sharp()
          .resize(null, 2000)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          { name: 'resize', args: [12, 2000, { fit: 'inside' }] },
        ]);
      });
    });

    it('should support avif 8bit as a source format', () => {
      return expect(
        'Chimera-AV1-8bit-480x270-552kbps-100.avif',
        'when piped through',
        impro.sharp().resize(10, 10).jpeg().flush(),
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
          size: { width: 10 },
        }
      );
    });

    // TODO: reenable once 10bit support is back in sharp pre-built binaries
    it.skip('should support avif 10bit as a source format', () => {
      return expect(
        'Chimera-AV1-10bit-480x270-531kbps-100.avif',
        'when piped through',
        impro.sharp().resize(10, 10).jpeg().flush(),
        'to yield output satisfying to have metadata satisfying',
        {
          format: 'JPEG',
          size: { width: 10 },
        }
      );
    });

    it('should support avif as a target format', () => {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.sharp().resize(10, 10).avif().flush(),
        'to yield output satisfying',
        'when decoded as',
        'ascii',
        'to match',
        // eslint-disable-next-line no-control-regex
        /^\x00{3}\x18ftypavif/
      );
    });
  });

  describe('with the gifsicle engine', () => {
    it('should prefer gifsicle for processing gifs', () =>
      expect(
        impro.type('gif').resize(10, 10).flush().usedEngines,
        'to satisfy',
        [{ name: 'gifsicle' }]
      ));

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

      impro.gifsicle().resize(10, null).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--resize-width',
        10,
      ]);
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

      impro.gifsicle().resize(null, 10).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--resize-height',
        10,
      ]);
    });

    it('should support resize followed by extract', () => {
      const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

      impro.gifsicle().resize(380, 486).extract(150, 150, 100, 100).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--resize-fit',
        '380x486',
        ';',
        '--crop',
        '150,150+100x100',
      ]);
    });

    it('should output resize followed by extract', () =>
      expect(
        'cat.gif',
        'when piped through',
        impro.gifsicle().resize(380, 486).extract(150, 150, 100, 100),
        'to yield output satisfying',
        expect
          .it('to have metadata satisfying', {
            size: { width: 100, height: 100 },
            Scene: ['0 of 4', '1 of 4', '2 of 4', '3 of 4'], // Animated
          })
          .and('to resemble', load('cat-resized-then-cropped.gif'))
      ));

    it('should use gm for gifs when gifsicle is disabled', () =>
      expect(
        impro.gifsicle(false).type('gif').resize(10, 10).flush().usedEngines,
        'to satisfy',
        [{ name: 'gm' }]
      ));

    describe('with a maxOutputPixels setting in place', () => {
      it('should support resize (only width)', () => {
        const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .gifsicle()
          .resize(2000, null)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          '--resize-fit',
          '2000x12',
        ]);
      });

      it('should support resize (only height)', () => {
        const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .gifsicle()
          .resize(null, 2000)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          '--resize-fit',
          '12x2000',
        ]);
      });
    });
  });

  describe('with the gm engine', () => {
    it('should output as a tiff', () =>
      expect(
        'bulb.gif',
        'when piped through',
        impro.gm().tiff(),
        'to yield output satisfying',
        'to have mime type',
        'image/tiff'
      ));

    it('should output as a tga', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.gm().tga(),
        'to yield output satisfying',
        expect.it('not to be empty')
      ));

    it('should output an image/x-icon as a png', () =>
      expect(
        'favicon.ico',
        'when piped through',
        impro.type('image/x-icon').gm().png(),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG',
        })
      ));

    it('should output an image/vnd.microsoft.icon as a png', () =>
      expect(
        'favicon.ico',
        'when piped through',
        impro.type('image/vnd.microsoft.icon').gm().png(),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG',
        })
      ));

    it('should support crop', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().crop('center').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'gravity', args: ['Center'] },
      ]);
    });

    it('should support progressive', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().progressive().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'interlace', args: ['line'] },
      ]);
    });

    it('should support resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().resize(10, 10).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10] },
      ]);
    });

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().resize(10, null).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, ''] },
      ]);
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().resize(null, 10).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: ['', 10] },
      ]);
    });

    it('should support withoutEnlargement', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().resize(10, 10).withoutEnlargement().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10, '>'] },
      ]);
    });

    it('should support ignoreAspectRatio', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro.gm().resize(10, 10).ignoreAspectRatio().flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10, '!'] },
      ]);
    });

    it('should emit an error on a bad conversion', () => {
      const gmEngine = impro.engineByName.gm;
      gmEngine.outputTypes.push('ico');
      const origExecute = gmEngine.execute;
      gmEngine.execute = function (pipeline, operations) {
        gmEngine.execute = origExecute;

        // override with an unsupported output type to trigger error path
        operations[0].name = 'ico';

        origExecute.call(this, pipeline, operations);
      };

      return expect(
        'bulb.gif',
        'when piped through',
        impro.gm().png(),
        'to error with',
        'gm: stream ended without emitting any data'
      ).finally(() => {
        gmEngine.execute = origExecute;
        gmEngine.outputTypes.splice(gmEngine.outputTypes.length - 1, 1);
      });
    });

    describe('with a maxOutputPixels setting in place', () => {
      it('should support resize (only width)', () => {
        const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .gm()
          .resize(2000, null)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          { name: 'resize', args: [2000, 12] },
        ]);
      });

      it('should support resize (only height)', () => {
        const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .gm()
          .resize(null, 2000)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          { name: 'resize', args: [12, 2000] },
        ]);
      });
    });
  });

  describe('with the inkscape engine', () => {
    before(function () {
      if (process.platform === 'darwin') {
        // On OS X the most commonly available Inkscape
        // is built against X11. In practice this means
        // that while it works for the conversion done
        // by impro it does so only after X11 starts up.
        // Harden the test suite against this by doing
        // a 'pre-flight' request so that everything is
        // started by the point the tests kick in.

        this.timeout(40000);

        return new Promise((resolve) => {
          childProcess
            .spawn('inkscape', ['--version'])
            .on('exit', () => resolve());
        });
      } else {
        this.timeout(8000);
      }
    });

    it('should convert to png by default', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.type('svg').inkscape(),
        'to yield output satisfying to resemble',
        load('dialog-information.png')
      ));

    it('should convert to png explicitly', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.type('svg').inkscape().png(),
        'to yield output satisfying to resemble',
        load('dialog-information.png')
      ));

    it('should convert to pdf', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.type('svg').inkscape().pdf(),
        'to yield output satisfying',
        'when decoded as',
        'utf-8',
        'to match',
        /^%PDF-1\.5/
      ));

    it('should convert to eps', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.type('svg').inkscape().eps(),
        'to yield output satisfying',
        'when decoded as',
        'utf-8',
        'to match',
        /^%!PS-Adobe-3.0/
      ));
  });

  describe('with the svgfilter engine', () => {
    it('should run the image through an SVG filter based on a script in an external file', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.svgfilter({
          url:
            'file://' + pathModule.resolve(__dirname, '..', 'testdata') + '/',
          runScript: 'addBogusElement.js',
          bogusElementId: 'theBogusElementId',
        }),
        'to yield output satisfying when decoded as',
        'utf-8',
        'when parsed as XML queried for first',
        'bogus',
        'to satisfy',
        { attributes: { id: 'theBogusElementId' } }
      ));

    it('should pass an svg assert url set on the pipeline into the engine', () =>
      expect(
        'dialog-information.svg',
        'when piped through',
        impro.createPipeline(
          {
            svgAssetPath: `${testDataPath}/`,
          },
          [
            {
              name: 'svgfilter',
              args: [
                {
                  runScript: 'addBogusElement.js',
                  bogusElementId: 'theBogusElementId',
                },
              ],
            },
          ]
        ),
        'to yield output satisfying when decoded as',
        'utf-8',
        'when parsed as XML queried for first',
        'bogus',
        'to satisfy',
        { attributes: { id: 'theBogusElementId' } }
      ));
  });

  describe('with the jpegtran engine', () => {
    it('process the image according to the given options', () =>
      expect(
        'turtle.jpg',
        'when piped through',
        impro.jpegtran().grayscale().flip('horizontal'),
        'to yield output satisfying',
        expect
          .it('to have metadata satisfying', {
            format: 'JPEG',
            'Channel Depths': {
              Gray: '8 bits',
            },
            size: {
              width: 481,
              height: 424,
            },
          })
          .and(
            'to satisfy',
            expect.it((buffer) => {
              expect(buffer.length, 'to be within', 1, 105836);
            })
          )
      ));

    it('should support arithmetic', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().arithmetic().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-arithmetic']);
    });

    it('should support crop', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      const pipeline = impro.jpegtran().crop(10, 10, 10, 10).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-crop',
        '10x10+10+10',
      ]).then(() => {
        // check that the external representation is unchanged
        expect(pipeline.usedEngines, 'to equal', [
          {
            name: 'jpegtran',
            operations: [
              {
                name: 'crop',
                args: [10, 10, 10, 10],
                engineName: 'jpegtran',
              },
            ],
            commandArgs: ['-crop', '10x10+10+10'],
          },
        ]);
      });
    });

    it('should support grayscale', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().grayscale().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-grayscale']);
    });

    it('should reject grayscale with invalid argument', () =>
      expect(
        () => {
          impro.jpegtran().grayscale({});
        },
        'to throw',
        'invalid operation or arguments: grayscale=[{}]'
      ));

    it('should support perfect', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().perfect().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-perfect']);
    });

    it('should support progressive', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().progressive().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-progressive']);
    });

    it('should support transpose', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().transpose().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-transpose']);
    });

    it('should support transverse', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro.jpegtran().transverse().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-transverse']);
    });
  });

  describe('with the optipng engine', () => {
    it('should process the image', () =>
      expect(
        'testImage.png',
        'when piped through',
        impro.optipng().o(7),
        'to yield output satisfying to have length',
        149
      ));

    it('should build the correct operation arguments', () =>
      expect(impro.optipng().o(7).flush().usedEngines, 'to satisfy', [
        {
          name: 'optipng',
          operations: [
            {
              name: 'o',
              args: [7],
            },
          ],
        },
      ]));

    it('should apply the correct command line arguments', () =>
      expect(impro.optipng().o(7).flush().usedEngines, 'to satisfy', [
        { name: 'optipng', commandArgs: ['-o', 7] },
      ]));

    it('should apply the tool in its default mode with no arguments', () =>
      expect(impro.optipng().flush().usedEngines, 'to satisfy', [
        { name: 'optipng', commandArgs: [] },
      ]));
  });

  describe('when manually managing the whether engines are enabled', () => {
    it('should use gm for gifs when gifsicle is disabled', () =>
      expect(
        impro.gifsicle(false).type('gif').resize(10, 10).flush().usedEngines,
        'to satisfy',
        [{ name: 'gm' }]
      ));

    it('should allow only temporarily disabling gifsicle', () =>
      expect(
        impro
          .gifsicle(false)
          .type('gif')
          .resize(10, 10)
          .gifsicle(true)
          .resize(20, 20)
          .flush().usedEngines,
        'to satisfy',
        [
          {
            name: 'gm',
            operations: [{ name: 'resize', args: [10, 10], engineName: 'gm' }],
          },
          {
            name: 'gifsicle',
            operations: [
              {
                name: 'resize',
                args: [20, 20],
                engineName: 'gifsicle',
              },
            ],
          },
        ]
      ));
  });

  describe('with the pngquant engine', () => {
    it('should process the image', () =>
      expect(
        'purplealpha24bit.png',
        'when piped through',
        impro.pngquant(),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG',
          size: {
            width: 100,
            height: 100,
          },
        })
      ));

    it('should process the image according to the given options', () =>
      expect(
        'purplealpha24bit.png',
        'when piped through',
        impro.pngquant().ncolors(256),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG',
          size: {
            width: 100,
            height: 100,
          },
        })
      ));

    it('should reject with invalid argument', () =>
      expect(
        () => {
          impro.jpegtran().ncolors(1);
        },
        'to throw',
        'invalid operation or arguments: ncolors=[1]'
      ));

    it('should support floyd', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().floyd(0.3).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--floyd',
        0.3,
        '-',
      ]);
    });

    it('should support ncolors', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().ncolors(2).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [2, '-']).finally(
        () => {
          executeSpy.restore();
        }
      );
    });

    it('should support posterize', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().posterize(0).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--posterize',
        0,
        '-',
      ]);
    });

    it('should support quality', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().quality('10-90').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--quality',
        '10-90',
        '-',
      ]);
    });

    it('should support speed', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().speed(1).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--speed',
        1,
        '-',
      ]);
    });

    it('should support multiple operations', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().speed(1).ncolors(256).flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--speed',
        1,
        256,
        '-',
      ]);
    });

    it('should support no operations', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro.pngquant().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-']).finally(
        () => {
          executeSpy.restore();
        }
      );
    });
  });

  describe('with the pngcrush engine', () => {
    it('process the image according to the given options', () =>
      expect(
        'purplealpha24bit.png',
        'when piped through',
        impro.pngcrush().rem('gAMA'),
        'to yield output satisfying',
        expect
          .it('when decoded as', 'ascii', 'not to match', /gAMA/)
          .and('to satisfy', {
            length: expect.it('to be greater than', 0),
          })
          .and('to have metadata satisfying', {
            format: 'PNG',
            size: {
              width: 100,
              height: 100,
            },
          })
      ));

    it('should support brute', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro.pngcrush().brute().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-brute']).finally(
        () => {
          executeSpy.restore();
        }
      );
    });

    it('should support reduce', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro.pngcrush().reduce().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-reduce']);
    });

    it('should support noreduce', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro.pngcrush().noreduce().flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-noreduce']);
    });

    it('should support rem', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro.pngcrush().rem('allb').flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-rem', 'allb']);
    });
  });

  describe('when there are errors duing streaming', () => {
    it('should cleanup on pipeline steam error', () => {
      const pipeline = impro
        .gifsicle(false)
        .type('gif')
        .resize(10, 10)
        .gifsicle(true)
        .resize(20, 20)
        .flush(); // force construstion of the child streams
      const secondStream = pipeline._streams[1];
      const error = new Error('Fake error');
      setImmediate(() => {
        secondStream.emit('error', error);
      });

      return expect(pipeline, 'to error with', error);
    });

    it('should cleanup the pipeline on a top level error', () => {
      const pipeline = impro
        .gifsicle(false)
        .type('gif')
        .resize(10, 10)
        .gifsicle(true)
        .resize(20, 20)
        .flush(); // force construstion of the child streams
      const endSpy = sinon.spy(pipeline._streams[0], 'end');
      const error = new Error('Fake error');
      setImmediate(() => {
        pipeline.emit('error', error);
      });

      return expect(pipeline, 'to error with', error).then(() =>
        expect(endSpy, 'was called')
      );
    });

    it('should error and include the command line for relevant engines (gm)', () => {
      const gmEngine = impro.engineByName.gm;
      gmEngine.outputTypes.push('ico');
      const origExecute = gmEngine.execute;
      gmEngine.execute = function (pipeline, operations) {
        gmEngine.execute = origExecute;

        // override with an unsupported output type to trigger error path
        operations[0].name = 'ico';

        origExecute.call(this, pipeline, operations);
      };

      return expect(
        'bulb.gif',
        'when piped through',
        impro.gm().png(),
        'to error with',
        expect.it('to satisfy', {
          commandLine: 'gm convert - ico:-',
        })
      ).finally(() => {
        gmEngine.execute = origExecute;
        gmEngine.outputTypes.splice(gmEngine.outputTypes.length - 1, 1);
      });
    });

    it('should error and include the command line for relevant engines (jpegtran)', () => {
      const pipeline = impro.jpegtran().grayscale().flush(); // force construstion of the child streams
      const jpegtranStream = pipeline._streams[0];
      const error = new Error('Fake error');
      setImmediate(() => {
        jpegtranStream.emit('error', error);
      });

      return expect(
        pipeline,
        'to error with',
        expect.it('to satisfy', {
          commandLine: 'jpegtran -grayscale',
        })
      );
    });

    it('should not break on error from an arbitrary stream with one stream', () => {
      const error = new Error('arranged error');
      const erroringStream = new stream.Transform();
      erroringStream._transform = () => {
        setImmediate(() => {
          erroringStream.emit('error', error);
        });
      };

      const pipeline = impro.createPipeline().addStream(erroringStream);

      return expect(
        'bulb.gif',
        'when piped through',
        pipeline,
        'to error with',
        expect.it('to equal', error).and('not to have property', 'commandLine')
      );
    });

    it('should not break on error from an arbitrary stream with two streams', () => {
      const error = new Error('arranged error');
      const erroringStream = new stream.Transform();
      erroringStream._transform = () => {
        setImmediate(() => {
          erroringStream.emit('error', error);
        });
      };

      const pipeline = impro
        .createPipeline()
        .addStream(new stream.PassThrough())
        .addStream(erroringStream);

      return expect(
        'bulb.gif',
        'when piped through',
        pipeline,
        'to error with',
        expect.it('to equal', error).and('not to have property', 'commandLine')
      );
    });
  });

  it('should not break on error occurring on the internal passthrough', () => {
    const error = new Error('arranged error');
    class UnchangedStream extends stream.Transform {
      _transform(chunk, encoding, cb) {
        cb(null, chunk);
      }
    }

    const pipeline = impro
      .createPipeline()
      .addStream(new UnchangedStream())
      .addStream(new UnchangedStream())
      .flush(); // force construstion of the child streams

    const internalPassThroughStream =
      pipeline._streams[pipeline._streams.length - 1];
    setImmediate(() => {
      internalPassThroughStream.emit('error', error);
    });

    return expect(
      'bulb.gif',
      'when piped through',
      pipeline,
      'to error with',
      expect.it('to equal', error).and('not to have property', 'commandLine')
    );
  });

  describe('with a maxOutputPixels setting', () => {
    it('should refuse to resize an image to exceed the max number of pixels (sharp)', () => {
      expect(
        () => {
          impro.maxOutputPixels(2).type('jpeg').resize(100, 100).flush();
        },
        'to throw',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });

    it('should refuse to resize an image to exceed the max number of pixels (gm)', () => {
      expect(
        () => {
          impro.maxOutputPixels(2).gm().resize(100, 100).flush();
        },
        'to throw',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });

    it('should refuse to resize an image to exceed the max number of pixels (gifsicle)', () => {
      expect(
        () => {
          impro.maxOutputPixels(2).gifsicle().resize(100, 100).flush();
        },
        'to throw',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });

    it('should correctly refuse due to max number of pixels after streaming starts', () => {
      const turtleJpg = loadAsStream('turtle.jpg');
      const pipeline = impro.maxOutputPixels(2).resize(100, 100);
      // close the file stream if the pipeline errors
      pipeline.on('error', () => {
        turtleJpg.unpipe();
        turtleJpg.close();
      });

      turtleJpg.pipe(turtleJpg);

      return expect(
        pipeline,
        'to error with',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });
  });
});
