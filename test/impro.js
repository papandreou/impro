var expect = require('unexpected')
  .clone()
  .use(require('unexpected-dom'))
  .use(require('unexpected-stream'))
  .use(require('unexpected-image'))
  .use(require('unexpected-sinon'))
  .use(require('unexpected-resemble'));
var childProcess = require('child_process');
var fileType = require('file-type');
var path = require('path');
var sinon = require('sinon');

var impro = require('../');

var memoizeSync = require('memoizesync');
var pathModule = require('path');
var fs = require('fs');

var testDataPath = pathModule.resolve(__dirname, '..', 'testdata');

var load = memoizeSync(function(fileName, platformsToOverride) {
  if (
    Array.isArray(platformsToOverride) &&
    platformsToOverride.includes(process.platform)
  ) {
    const ext = path.extname(fileName);
    fileName = [path.basename(fileName, ext), '-', process.platform, ext].join(
      ''
    );
  }

  return fs.readFileSync(
    pathModule.resolve(__dirname, '..', 'testdata', fileName)
  );
});

var loadAsStream = function(fileName) {
  return fs.createReadStream(
    pathModule.resolve(__dirname, '..', 'testdata', fileName)
  );
};

expect.addAssertion(
  '<string> when piped through <Stream> <assertion?>',
  function(expect, subject, ...rest) {
    expect.errorMode = 'nested';
    return expect(load(subject), 'when piped through', ...rest);
  }
);

expect.addAssertion('<Buffer> to have mime type <string>', function(
  expect,
  subject,
  value
) {
  expect.errorMode = 'nested';
  return expect(fileType(subject).mime, 'to equal', value);
});

expect.addAssertion('<Stream> to yield JSON output satisfying <any>', function(
  expect,
  subject,
  value
) {
  return expect(
    subject,
    'to yield output satisfying when decoded as',
    'utf-8',
    'when passed as parameter to',
    JSON.parse,
    'to satisfy',
    value
  );
});

describe('impro', function() {
  it('should be an instance of impro.Impro', function() {
    expect(impro, 'to be an', impro.Impro);
  });

  it('should allow instantiation with an object', function() {
    expect(new impro.Impro({}), 'to be an', impro.Impro);
  });

  it('should throw on invalid options', function() {
    expect(() => new impro.Impro('foo'), 'to throw', 'invalid options');
  });

  it('should allow an image engine to be explicitly selected', function() {
    return expect(
      'turtle.jpg',
      'when piped through',
      impro
        .gm()
        .resize(40, 15)
        .crop('center'),
      'to yield output satisfying to resemble',
      load('turtleCroppedCenterGm.jpg', ['darwin'])
    );
  });

  it('should maintain an array of engines that have been applied', function() {
    return expect(
      impro
        .sharp()
        .resize(10, 10)
        .gm()
        .extract(10, 20, 30, 40)
        .flush().usedEngines,
      'to satisfy',
      [
        {
          name: 'sharp',
          operations: [{ name: 'resize', args: [10, 10] }]
        },
        {
          name: 'gm',
          operations: [{ name: 'extract', args: [10, 20, 30, 40] }]
        }
      ]
    );
  });

  it('should allow a type conversion', function() {
    return expect(impro.png().flush().usedEngines, 'to satisfy', [
      {
        name: 'sharp',
        operations: [{ name: 'png', args: [] }]
      }
    ]);
  });

  it('should allow multiple type conversions', function() {
    return expect(
      impro
        .type('gif')
        .resize(10, 10)
        .png()
        .quality(88)
        .flush().usedEngines,
      'to satisfy',
      [
        {
          name: 'gifsicle',
          operations: [{ name: 'resize', args: [10, 10] }]
        },
        {
          name: 'sharp',
          operations: [
            { name: 'png', args: [] },
            { name: 'quality', args: [88], engineName: 'sharp' }
          ]
        }
      ]
    );
  });

  it('should not provide a targetContentType when no source content type is given and no explicit conversion has been performed', function() {
    return expect(impro.resize(40, 15).crop('center'), 'to satisfy', {
      targetContentType: undefined
    });
  });

  describe('when passed an object', function() {
    it('should interpret unsupported properties as source metadata', function() {
      expect(impro.source({ foo: 'bar' }).sourceMetadata, 'to equal', {
        foo: 'bar'
      });
    });

    it('should support a type property', function() {
      expect(impro.type('gif').targetContentType, 'to equal', 'image/gif');
    });

    it('should support a type property that is a full Content-Type', function() {
      expect(
        impro.type('image/gif').targetContentType,
        'to equal',
        'image/gif'
      );
    });
  });

  describe('#createPipeline', () => {
    it('should allow directly setting an output type option', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);
      const pipeline = customImpro.createPipeline({ type: 'gif' }).flush();

      expect(pipeline, 'to satisfy', {
        sourceType: 'gif',
        targetType: 'gif',
        targetContentType: 'image/gif'
      });
    });

    it('should process and execute instructions when passed a query string', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.createPipeline('resize=40,15&crop=center'),
        'to yield output satisfying to resemble',
        load('turtleCroppedCenter.jpg')
      );
    });

    it('should process and execute instructions when passed an array of operation objects', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.createPipeline([
          { name: 'resize', args: [40, 15] },
          { name: 'crop', args: ['center'] }
        ]),
        'to yield output satisfying to resemble',
        load('turtleCroppedCenter.jpg')
      );
    });

    it('should throw if the operations definition is not supported', function() {
      return expect(
        () => {
          impro.createPipeline({}, {});
        },
        'to throw',
        'Pipeline creation can only be supplied an operations array or string'
      );
    });

    it('should throw when flushing unsupported operations', function() {
      return expect(
        () => {
          impro
            .createPipeline(null, [{ name: 'nonexistent', args: [] }])
            .flush();
        },
        'to throw',
        'No supported engine can carry out this sequence of operations'
      );
    });

    it('should throw early from the chaining interface on an unsupported operation', function() {
      return expect(
        () => {
          impro.createPipeline({}).crop();
        },
        'to throw',
        'invalid operation or arguments: crop=[]'
      );
    });
  });

  describe('#getEngine', () => {
    it('should allow directly setting an output type option', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.getEngine('gifsicle'),
        'to equal',
        impro.engines.gifsicle
      );
    });

    it('should throw with an unsupported engine', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine('sharp'),
        'to throw error',
        'unknown engine sharp'
      );
    });

    it('should throw with no engine name', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine(),
        'to throw error',
        'unknown engine unknown'
      );
    });

    it('should throw with bad engine name', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        () => customImpro.getEngine({}),
        'to throw error',
        'unknown engine unknown'
      );
    });
  });

  describe('#isOperationSupportedByEngine', () => {
    it('should return true for a supported operation', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.isOperationSupportedByEngine('crop', 'gifsicle'),
        'to be true'
      );
    });

    it('should return false for an unsupported operation', function() {
      const customImpro = new impro.Impro().use(impro.engines.gifsicle);

      return expect(
        customImpro.isOperationSupportedByEngine('randomname', 'gifsicle'),
        'to be false'
      );
    });
  });

  describe('#parse', function() {
    it('should return an object with the operations and the leftover parameters, given a query string', function() {
      expect(impro.parse('foo=bar&resize=120,120'), 'to equal', {
        operations: [{ name: 'resize', args: [120, 120] }],
        leftover: 'foo=bar'
      });
    });

    it('should parse an engine and preserve any additional options passed to it', function() {
      expect(
        impro.parse(
          `svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId`
        ),
        'to equal',
        {
          operations: [
            {
              name: 'svgfilter',
              args: [
                {
                  runScript: 'addBogusElement.js',
                  bogusElementId: 'theBogusElementId'
                }
              ]
            }
          ],
          leftover: ''
        }
      );
    });

    it('should parse an engine ignoring any restricted properties', function() {
      expect(impro.parse(`svgfilter=svgAssetPath=anything`), 'to equal', {
        operations: [
          {
            name: 'svgfilter',
            args: []
          }
        ],
        leftover: ''
      });
    });

    it('should parse an engine and ignore any invalid options', function() {
      expect(impro.parse(`pngcrush=8`), 'to equal', {
        operations: [
          {
            name: 'pngcrush',
            args: []
          }
        ],
        leftover: ''
      });
    });

    it('should parse metadata without options', function() {
      expect(impro.parse('metadata'), 'to equal', {
        operations: [
          {
            name: 'metadata',
            args: []
          }
        ],
        leftover: ''
      });
    });

    it('should parse a resize operation with only one of the pair (left)', function() {
      expect(impro.parse('resize=10,'), 'to equal', {
        operations: [
          {
            name: 'resize',
            args: [10, null]
          }
        ],
        leftover: ''
      });
    });

    it('should parse a resize operation with only one of the pair (right)', function() {
      expect(impro.parse('resize=,10'), 'to equal', {
        operations: [
          {
            name: 'resize',
            args: [null, 10]
          }
        ],
        leftover: ''
      });
    });

    it('should ensure a custom allowOperation function takes effect for engines', function() {
      impro.allowOperation = () => false;

      return expect(impro.parse('metadata'), 'to equal', {
        operations: [],
        leftover: 'metadata'
      }).finally(() => {
        delete impro.allowOperation;
      });
    });

    it('should support suppplying a custom allowOperation function directly', function() {
      expect(
        impro.parse('png', () => false),
        'to equal',
        {
          operations: [],
          leftover: 'png'
        }
      );
    });
  });

  describe('when adding the processing instructions via individual method calls', function() {
    it('should return a duplex stream that executes the processing instructions', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.resize(40, 15).crop('center'),
        'to yield output satisfying to resemble',
        load('turtleCroppedCenter.jpg')
      );
    });
  });

  describe('when given a source content type', function() {
    it('should default to output an image of the same type', function() {
      return expect(
        impro
          .type('image/jpeg')
          .resize(40, 15)
          .crop('center'),
        'to satisfy',
        {
          targetContentType: 'image/jpeg'
        }
      );
    });

    it('should honor an explicit type conversion', function() {
      return expect(
        impro
          .type('image/jpeg')
          .gif()
          .flush(),
        'to satisfy',
        {
          targetType: 'gif',
          targetContentType: 'image/gif'
        }
      );
    });
  });

  describe('#metadata', function() {
    it('should produce the metadata of an image as JSON', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.metadata(),
        'to yield JSON output satisfying',
        {
          contentType: 'image/jpeg',
          width: 481,
          height: 424,
          space: 'srgb',
          channels: 3,
          hasProfile: false,
          hasAlpha: false
        }
      );
    });

    it('should include EXIF metadata in the output JSON', function() {
      return expect(
        'exif.jpg',
        'when piped through',
        impro.metadata(),
        'to yield JSON output satisfying',
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
            ExifOffset: 192
          }),
          // included due to the source image being rotated
          width: 4032,
          height: 3024,
          orientedWidth: 3024,
          orientedHeight: 4032
        }
      );
    });

    it('should include source metadata provided via the meta method', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.source({ filesize: 105836, etag: 'W/"foobar"' }).metadata(),
        'to yield JSON output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: 105836,
          etag: /^W\//
        }
      );
    });

    it('should include source metadata provided via the meta method when supplied as a pipeline option', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro
          .createPipeline({
            sourceMetadata: { filesize: 105836, etag: 'W/"foobar"' }
          })
          .metadata(),
        'to yield JSON output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: 105836,
          etag: 'W/"foobar"'
        }
      );
    });

    it('should not include source metadata provided via the meta method when an operation has been performed', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro
          .source({ filesize: 105836, etag: 'W/"foobar"' })
          .resize(10, 10)
          .metadata(),
        'to yield JSON output satisfying',
        {
          contentType: 'image/jpeg',
          filesize: undefined,
          etag: undefined,
          width: 10,
          height: 10
        }
      );
    });

    it('should allow retrieving the metadata for an image with a specified type', function() {
      return expect(
        'exif.jpg',
        'when piped through',
        impro.type('image/jpeg').metadata(),
        'to yield JSON output satisfying',
        {
          contentType: 'image/jpeg'
        }
      );
    });

    it('should allow retrieving the metadata of a non-image file with a non-image extension', function() {
      return expect(
        'something.txt',
        'when piped through',
        impro.type('text/plain; charset=UTF-8').metadata(),
        'to yield JSON output satisfying',
        {
          error: 'Input buffer contains unsupported image format',
          contentType: 'text/plain; charset=UTF-8'
        }
      );
    });

    it('should set animated:true for an animated gif', function() {
      return expect(
        'animated.gif',
        'when piped through',
        impro.metadata(),
        'to yield JSON output satisfying',
        {
          animated: true
        }
      );
    });

    it('should set animated:false for a non-animated gif', function() {
      return expect(
        'bulb.gif',
        'when piped through',
        impro.metadata(),
        'to yield JSON output satisfying',
        {
          animated: false
        }
      );
    });

    it(
      'should allow passing a cache option',
      sinon.test(function() {
        var cacheSpy = this.spy(require('sharp'), 'cache');
        var improInstance = new impro.Impro().use(impro.engines.metadata);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance.metadata({ cache: 123 }),
          'to yield JSON output satisfying',
          {
            contentType: 'image/jpeg'
          }
        )
          .then(function() {
            expect(cacheSpy, 'to have calls satisfying', function() {
              cacheSpy(123);
            });
          })
          .finally(() => cacheSpy.restore());
      })
    );

    it(
      'should allow passing a sharpCache option to the pipeline',
      sinon.test(function() {
        var cacheSpy = this.spy(require('sharp'), 'cache');
        var improInstance = new impro.Impro().use(impro.engines.metadata);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance.createPipeline({ sharpCache: 456 }).metadata(),
          'to yield JSON output satisfying',
          {
            contentType: 'image/jpeg'
          }
        )
          .then(function() {
            expect(cacheSpy, 'to have calls satisfying', function() {
              cacheSpy(456);
            });
          })
          .finally(() => cacheSpy.restore());
      })
    );
  });

  describe('with the sharp engine', function() {
    it(
      'should allow passing a cache option',
      sinon.test(function() {
        var cacheSpy = this.spy(require('sharp'), 'cache');
        var improInstance = new impro.Impro().use(impro.engines.sharp);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance.sharp({ cache: 123 }).resize(10, 10),
          'to yield output satisfying to have metadata satisfying',
          {
            format: 'JPEG'
          }
        )
          .then(function() {
            expect(cacheSpy, 'to have calls satisfying', function() {
              cacheSpy(123);
            });
          })
          .finally(() => cacheSpy.restore());
      })
    );

    it(
      'should allow passing a sharpCache option to the pipeline',
      sinon.test(function() {
        var cacheSpy = this.spy(require('sharp'), 'cache');
        var improInstance = new impro.Impro().use(impro.engines.sharp);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance.createPipeline({ sharpCache: 456 }).resize(10, 10),
          'to yield output satisfying to have metadata satisfying',
          {
            format: 'JPEG'
          }
        )
          .then(function() {
            expect(cacheSpy, 'to have calls satisfying', function() {
              cacheSpy(456);
            });
          })
          .finally(() => cacheSpy.restore());
      })
    );

    it(
      'should allow passing a sequentialRead option',
      sinon.test(function() {
        var sequentialReadSpy = this.spy(
          require('sharp').prototype,
          'sequentialRead'
        );
        var improInstance = new impro.Impro().use(impro.engines.sharp);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance
            .sharp({ sequentialRead: true })
            .type('jpeg')
            .resize(10, 10),
          'to yield output satisfying to have metadata satisfying',
          {
            format: 'JPEG'
          }
        )
          .then(function() {
            expect(sequentialReadSpy, 'to have calls satisfying', function() {
              sequentialReadSpy();
            });
          })
          .finally(() => sequentialReadSpy.restore());
      })
    );

    it(
      'should only call sharp.cache once, even after processing multiple images',
      sinon.test(function() {
        var cacheSpy = this.spy(require('sharp'), 'cache');
        var improInstance = new impro.Impro().use(impro.engines.sharp);
        return expect(
          'turtle.jpg',
          'when piped through',
          improInstance
            .sharp({ cache: 123 })
            .type('jpeg')
            .resize(10, 10),
          'to yield output satisfying to have metadata satisfying',
          {
            format: 'JPEG'
          }
        )
          .then(() =>
            expect(
              'turtle.jpg',
              'when piped through',
              impro
                .sharp({ cache: 123 })
                .type('jpeg')
                .resize(10, 10),
              'to yield output satisfying to have metadata satisfying',
              {
                format: 'JPEG'
              }
            )
          )
          .then(() =>
            expect(cacheSpy, 'to have calls satisfying', () => cacheSpy(123))
          )
          .finally(() => cacheSpy.restore());
      })
    );

    it('should support blur with no argument', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .type('jpg')
        .blur()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'blur',
          args: []
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support blur with an argument', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .type('jpg')
        .blur(0.5)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'blur',
          args: [0.5]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support quality', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      const usedEngines = impro
        .type('jpeg')
        .quality(88)
        .flush().usedEngines;

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'jpeg',
          args: [{ quality: 88 }]
        }
      ])
        .then(() => {
          // check that the external representation is unchanged
          return expect(usedEngines, 'to satisfy', [
            {
              name: 'sharp',
              operations: expect.it('to equal', [
                {
                  name: 'quality',
                  args: [88],
                  engineName: 'sharp'
                }
              ])
            }
          ]);
        })
        .finally(() => {
          executeSpy.restore();
        });
    });

    it('should throw on quality without a target type', () => {
      return expect(
        () => {
          impro.quality(88).flush();
        },
        'to throw',
        'sharp: quality() operation must follow output type selection'
      );
    });

    it('should support progressive', () => {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.type('jpeg').progressive(),
        'to yield output satisfying to have metadata satisfying',
        {
          Interlace: 'Line'
        }
      );
    });

    it('should support rotate', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .type('jpg')
        .rotate(90)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'rotate',
          args: [90]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .sharp()
        .resize(10, null)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, null] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .sharp()
        .resize(null, 10)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [null, 10] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support crop without resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('center').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'center' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
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
          args: [10, 10, { fit: 'cover', position: 'northwest' }]
        }
      ])
        .then(() => {
          // check that the external representation is unchanged
          return expect(usedEngines, 'to satisfy', [
            {
              name: 'sharp',
              operations: expect.it('to equal', [
                {
                  name: 'resize',
                  args: [10, 10],
                  engineName: 'sharp'
                },
                {
                  name: 'crop',
                  args: ['northwest'],
                  engineName: 'sharp'
                }
              ])
            }
          ]);
        })
        .finally(() => {
          executeSpy.restore();
        });
    });

    it('should support crop with "attention"', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('attention').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'attention' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support crop with "entropy"', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.crop('entropy').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'cover', position: 'entropy' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support embed without resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro.embed('north').flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [null, null, { fit: 'contain', position: 'north' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
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
          args: [10, 10, { fit: 'contain', position: 'northwest' }]
        }
      ])
        .then(() => {
          // check that the external representation is unchanged
          return expect(usedEngines, 'to satisfy', [
            {
              name: 'sharp',
              operations: expect.it('to equal', [
                {
                  name: 'resize',
                  args: [10, 10],
                  engineName: 'sharp'
                },
                {
                  name: 'embed',
                  args: ['northwest'],
                  engineName: 'sharp'
                }
              ])
            }
          ]);
        })
        .finally(() => {
          executeSpy.restore();
        });
    });

    it('should throw on withoutEnlargement without resize', () => {
      return expect(
        () => {
          impro.withoutEnlargement().flush();
        },
        'to throw',
        'sharp: withoutEnlargement() operation must follow resize'
      );
    });

    it('should support withoutEnlargement', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .resize(10, 10)
        .withoutEnlargement()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'inside' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should throw on ignoreAspectRatio without resize', () => {
      return expect(
        () => {
          impro.ignoreAspectRatio().flush();
        },
        'to throw',
        'sharp: ignoreAspectRatio() operation must follow resize'
      );
    });

    it('should support ignoreAspectRatio', () => {
      const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

      impro
        .resize(10, 10)
        .ignoreAspectRatio()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        {
          name: 'resize',
          args: [10, 10, { fit: 'fill' }]
        }
      ]).finally(() => {
        executeSpy.restore();
      });
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
          { name: 'resize', args: [2000, 12, { fit: 'inside' }] }
        ]).finally(() => {
          executeSpy.restore();
        });
      });

      it('should support resize (only height)', () => {
        const executeSpy = sinon.spy(impro.engineByName.sharp, 'execute');

        impro
          .createPipeline({ maxOutputPixels: 25000 })
          .sharp()
          .resize(null, 2000)
          .flush();

        return expect(executeSpy.returnValues[0], 'to equal', [
          { name: 'resize', args: [12, 2000, { fit: 'inside' }] }
        ]).finally(() => {
          executeSpy.restore();
        });
      });
    });
  });

  describe('with the gifsicle engine', function() {
    it('should handle resize before extract', function() {
      return expect(
        'cat.gif',
        'when piped through',
        impro
          .gifsicle()
          .resize(380, 486)
          .extract(150, 150, 100, 100),
        'to yield output satisfying',
        expect
          .it('to have metadata satisfying', {
            size: { width: 100, height: 100 },
            Scene: ['0 of 4', '1 of 4', '2 of 4', '3 of 4'] // Animated
          })
          .and('to resemble', load('cat-resized-then-cropped.gif'))
      );
    });

    it('should prefer gifsicle for processing gifs', function() {
      return expect(
        impro
          .type('gif')
          .resize(10, 10)
          .flush().usedEngines,
        'to satisfy',
        [{ name: 'gifsicle' }]
      );
    });

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

      impro
        .gifsicle()
        .resize(10, null)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        ['--resize-width', 10]
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gifsicle, 'execute');

      impro
        .gifsicle()
        .resize(null, 10)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        ['--resize-height', 10]
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should use gm for gifs when gifsicle is disabled', function() {
      return expect(
        impro
          .gifsicle(false)
          .type('gif')
          .resize(10, 10)
          .flush().usedEngines,
        'to satisfy',
        [{ name: 'gm' }]
      );
    });
  });

  describe('with the gm engine', function() {
    it('should output as a tiff', function() {
      return expect(
        'bulb.gif',
        'when piped through',
        impro.gm().tiff(),
        'to yield output satisfying',
        'to have mime type',
        'image/tiff'
      );
    });

    it('should output as a tga', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro.gm().tga(),
        'to yield output satisfying',
        expect.it('not to be empty')
      );
    });

    it('should output an image/x-icon as a png', function() {
      return expect(
        'favicon.ico',
        'when piped through',
        impro
          .type('image/x-icon')
          .gm()
          .png(),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG'
        })
      );
    });

    it('should output an image/vnd.microsoft.icon as a png', function() {
      return expect(
        'favicon.ico',
        'when piped through',
        impro
          .type('image/vnd.microsoft.icon')
          .gm()
          .png(),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG'
        })
      );
    });

    it('should support crop', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .crop('center')
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'gravity', args: ['Center'] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support progressive', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .progressive()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'interlace', args: ['line'] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .resize(10, 10)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize (only width)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .resize(10, null)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, ''] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support resize (only height)', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .resize(null, 10)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: ['', 10] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support withoutEnlargement', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .resize(10, 10)
        .withoutEnlargement()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10, '>'] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support ignoreAspectRatio', () => {
      const executeSpy = sinon.spy(impro.engineByName.gm, 'execute');

      impro
        .gm()
        .resize(10, 10)
        .ignoreAspectRatio()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        { name: 'resize', args: [10, 10, '!'] }
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should emit an error on a bad conversion', function() {
      const gmEngine = impro.engineByName.gm;
      gmEngine.outputTypes.push('ico');
      const origExecute = gmEngine.execute;
      gmEngine.execute = function(pipeline, operations) {
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
  });

  describe('with the inkscape engine', function() {
    before(function() {
      if (process.platform === 'darwin') {
        // On OS X the most commonly available Inkscape
        // is built against X11. In practice this means
        // that while it works for the conversion done
        // by impro it does so only after X11 starts up.
        // Harden the test suite against this by doing
        // a 'pre-flight' request so that everything is
        // started by the point the tests kick in.

        this.timeout(40000);

        return new Promise(resolve => {
          childProcess
            .spawn('inkscape', ['--without-gui'])
            .on('exit', () => resolve());
        });
      }
    });

    it('should convert to png by default', function() {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro.type('svg').inkscape(),
        'to yield output satisfying to resemble',
        load('dialog-information.png')
      );
    });

    it('should convert to png explicitly', function() {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro
          .type('svg')
          .inkscape()
          .png(),
        'to yield output satisfying to resemble',
        load('dialog-information.png')
      );
    });

    it('should convert to pdf', function() {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro
          .type('svg')
          .inkscape()
          .pdf(),
        'to yield output satisfying',
        'when decoded as',
        'utf-8',
        'to match',
        /^%PDF-1\.4/
      );
    });

    it('should convert to eps', function() {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro
          .type('svg')
          .inkscape()
          .eps(),
        'to yield output satisfying',
        'when decoded as',
        'utf-8',
        'to match',
        /^%!PS-Adobe-3.0/
      );
    });
  });

  describe('with the svgfilter engine', function() {
    it('should run the image through an SVG filter based on a script in an external file', function() {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro.svgfilter({
          url:
            'file://' + pathModule.resolve(__dirname, '..', 'testdata') + '/',
          runScript: 'addBogusElement.js',
          bogusElementId: 'theBogusElementId'
        }),
        'to yield output satisfying when decoded as',
        'utf-8',
        'when parsed as XML queried for first',
        'bogus',
        'to satisfy',
        { attributes: { id: 'theBogusElementId' } }
      );
    });

    it('should pass an svg assert url set on the pipeline into the engine', () => {
      return expect(
        'dialog-information.svg',
        'when piped through',
        impro.createPipeline(
          {
            svgAssetPath: `${testDataPath}/`
          },
          [
            {
              name: 'svgfilter',
              args: [
                {
                  runScript: 'addBogusElement.js',
                  bogusElementId: 'theBogusElementId'
                }
              ]
            }
          ]
        ),
        'to yield output satisfying when decoded as',
        'utf-8',
        'when parsed as XML queried for first',
        'bogus',
        'to satisfy',
        { attributes: { id: 'theBogusElementId' } }
      );
    });
  });

  describe('with the jpegtran engine', function() {
    it('process the image according to the given options', function() {
      return expect(
        'turtle.jpg',
        'when piped through',
        impro
          .jpegtran()
          .grayscale()
          .flip('horizontal'),
        'to yield output satisfying',
        expect
          .it('to have metadata satisfying', {
            format: 'JPEG',
            'Channel Depths': {
              Gray: '8 bits'
            },
            size: {
              width: 481,
              height: 424
            }
          })
          .and('to satisfy', function(buffer) {
            expect(buffer.length, 'to be within', 1, 105836);
          })
      );
    });

    it('should support arithmetic', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .arithmetic()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-arithmetic'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support crop', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      const pipeline = impro
        .jpegtran()
        .crop(10, 10, 10, 10)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-crop',
        '10x10+10+10'
      ])
        .then(() => {
          // check that the external representation is unchanged
          expect(pipeline.usedEngines, 'to equal', [
            {
              name: 'jpegtran',
              operations: [
                {
                  name: 'crop',
                  args: [10, 10, 10, 10],
                  engineName: 'jpegtran'
                }
              ],
              commandLine: 'jpegtran -crop 10x10+10+10'
            }
          ]);
        })
        .finally(() => {
          executeSpy.restore();
        });
    });

    it('should support grayscale', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .grayscale()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-grayscale'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should reject grayscale with invalid argument', () => {
      return expect(
        () => {
          impro.jpegtran().grayscale({});
        },
        'to throw',
        'invalid operation or arguments: grayscale=[{}]'
      );
    });

    it('should support perfect', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .perfect()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-perfect'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support progressive', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .progressive()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-progressive'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support transpose', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .transpose()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-transpose'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support transverse', () => {
      const executeSpy = sinon.spy(impro.engineByName.jpegtran, 'execute');

      impro
        .jpegtran()
        .transverse()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-transverse'
      ]).finally(() => {
        executeSpy.restore();
      });
    });
  });

  describe('with the optipng engine', function() {
    it('process the image according to the given options', function() {
      return expect(
        'testImage.png',
        'when piped through',
        impro.add({ name: 'optipng', args: ['-o7'] }),
        'to yield output satisfying to have length',
        149
      );
    });
  });

  describe('when manually managing the whether engines are enabled', () => {
    it('should use gm for gifs when gifsicle is disabled', function() {
      return expect(
        impro
          .gifsicle(false)
          .type('gif')
          .resize(10, 10)
          .flush().usedEngines,
        'to satisfy',
        [{ name: 'gm' }]
      );
    });

    it('should allow only temporarily disabling gifsicle', function() {
      return expect(
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
            operations: [{ name: 'resize', args: [10, 10], engineName: 'gm' }]
          },
          {
            name: 'gifsicle',
            operations: [
              {
                name: 'resize',
                args: [20, 20],
                engineName: 'gifsicle'
              }
            ]
          }
        ]
      );
    });
  });

  describe('with the pngquant engine', function() {
    it('should process the image according to the given options', function() {
      return expect(
        'purplealpha24bit.png',
        'when piped through',
        impro.pngquant().speed(8),
        'to yield output satisfying',
        expect.it('to have metadata satisfying', {
          format: 'PNG',
          size: {
            width: 100,
            height: 100
          }
        })
      );
    });

    it('should support floyd', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro
        .pngquant()
        .floyd(0.3)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--floyd',
        0.3,
        '-'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support posterize', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro
        .pngquant()
        .posterize(0)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--posterize',
        0,
        '-'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support quality', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro
        .pngquant()
        .quality('10-90')
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--quality',
        '10-90',
        '-'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support speed', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngquant, 'execute');

      impro
        .pngquant()
        .speed(1)
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '--speed',
        1,
        '-'
      ]).finally(() => {
        executeSpy.restore();
      });
    });
  });

  describe('with the pngcrush engine', function() {
    it('process the image according to the given options', function() {
      return expect(
        'purplealpha24bit.png',
        'when piped through',
        impro.pngcrush().rem('gAMA'),
        'to yield output satisfying',
        expect
          .it('when decoded as', 'ascii', 'not to match', /gAMA/)
          .and('to satisfy', {
            length: expect.it('to be greater than', 0)
          })
          .and('to have metadata satisfying', {
            format: 'PNG',
            size: {
              width: 100,
              height: 100
            }
          })
      );
    });

    it('should support brute', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro
        .pngcrush()
        .brute()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', ['-brute']).finally(
        () => {
          executeSpy.restore();
        }
      );
    });

    it('should support reduce', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro
        .pngcrush()
        .reduce()
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-reduce'
      ]).finally(() => {
        executeSpy.restore();
      });
    });

    it('should support rem', () => {
      const executeSpy = sinon.spy(impro.engineByName.pngcrush, 'execute');

      impro
        .pngcrush()
        .rem('allb')
        .flush();

      return expect(executeSpy.returnValues[0], 'to equal', [
        '-rem',
        'allb'
      ]).finally(() => {
        executeSpy.restore();
      });
    });
  });

  describe('when there are errors duing streaming', () => {
    it('should cleanup on pipeline steam error', function() {
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

    it('should cleanup the pipeline on a top level error', function() {
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

    it('should error and include the command line for relevant engines', function() {
      const pipeline = impro
        .jpegtran()
        .grayscale()
        .flush(); // force construstion of the child streams
      const jpegtranStream = pipeline._streams[0];
      const error = new Error('Fake error');
      setImmediate(() => {
        jpegtranStream.emit('error', error);
      });

      return expect(
        pipeline,
        'to error with',
        expect.it('to satisfy', {
          commandLine: 'jpegtran -grayscale'
        })
      );
    });
  });

  describe('with a maxOutputPixels setting', function() {
    it('should refuse to resize an image to exceed the max number of pixels', function() {
      expect(
        function() {
          impro
            .maxOutputPixels(2)
            .type('jpeg')
            .resize(100, 100)
            .flush();
        },
        'to throw',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });

    it('should refuse to resize an image to exceed the max number of pixels, gm', function() {
      expect(
        function() {
          impro
            .maxOutputPixels(2)
            .gm()
            .resize(100, 100)
            .flush();
        },
        'to throw',
        'resize: Target dimensions of 100x100 exceed maxOutputPixels (2)'
      );
    });

    it('should correctly due to max number of pixels after streaming starts', function() {
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
