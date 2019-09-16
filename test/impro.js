var expect = require('unexpected')
    .clone()
    .use(require('unexpected-dom'))
    .use(require('unexpected-stream'))
    .use(require('unexpected-image'))
    .use(require('unexpected-sinon'))
    .use(require('unexpected-resemble'));
var childProcess = require('child_process');
var path = require('path');
var sinon = require('sinon');

var impro = require('../');

var memoizeSync = require('memoizesync');
var pathModule = require('path');
var fs = require('fs');

var load = memoizeSync(function(fileName, platformsToOverride) {
    if (
        Array.isArray(platformsToOverride) &&
        platformsToOverride.includes(process.platform)
    ) {
        const ext = path.extname(fileName);
        fileName = [
            path.basename(fileName, ext),
            '-',
            process.platform,
            ext
        ].join('');
    }

    return fs.readFileSync(
        pathModule.resolve(__dirname, '..', 'testdata', fileName)
    );
});

expect.addAssertion(
    '<string> when piped through <Stream> <assertion?>',
    function(expect, subject, ...rest) {
        expect.errorMode = 'nested';
        return expect(load(subject), 'when piped through', ...rest);
    }
);

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

    describe('when passed an object', function() {
        it('should interpret unsupported properties as source metadata', function() {
            expect(impro.source({ foo: 'bar' }).sourceMetadata, 'to equal', {
                foo: 'bar'
            });
        });

        it('should support a type property', function() {
            expect(
                impro.type('gif').targetContentType,
                'to equal',
                'image/gif'
            );
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
            const pipeline = customImpro
                .createPipeline({ type: 'gif' })
                .flush();

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
    });

    describe('#parse', function() {
        it('should return an object with the operations and the leftover parameters, given a query string', function() {
            expect(impro.parse('foo=bar&resize=120,120'), 'to equal', {
                operations: [{ name: 'resize', args: [120, 120] }],
                leftover: 'foo=bar'
            });
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
                    targetContentType: 'image/gif'
                }
            );
        });
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
                .flush(),
            'to satisfy',
            {
                usedEngines: [
                    {
                        name: 'sharp',
                        operations: [{ name: 'resize', args: [10, 10] }]
                    },
                    {
                        name: 'gm',
                        operations: [
                            { name: 'extract', args: [10, 20, 30, 40] }
                        ]
                    }
                ]
            }
        );
    });

    it('should not provide a targetContentType when no source content type is given and no explicit conversion has been performed', function() {
        return expect(impro.resize(40, 15).crop('center'), 'to satisfy', {
            targetContentType: undefined
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
                    })
                }
            );
        });

        it('should include source metadata provided via the meta method', function() {
            return expect(
                'turtle.jpg',
                'when piped through',
                impro
                    .source({ filesize: 105836, etag: 'W/"foobar"' })
                    .metadata(),
                'to yield JSON output satisfying',
                {
                    contentType: 'image/jpeg',
                    filesize: 105836,
                    etag: /^W\//
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
                        expect(
                            cacheSpy,
                            'to have calls satisfying',
                            function() {
                                cacheSpy(123);
                            }
                        );
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
                        expect(
                            sequentialReadSpy,
                            'to have calls satisfying',
                            function() {
                                sequentialReadSpy();
                            }
                        );
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
                        expect(cacheSpy, 'to have calls satisfying', () =>
                            cacheSpy(123)
                        )
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

        it('should combine resize with crop', () => {
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
                    .flush(),
                'to satisfy',
                { usedEngines: [{ name: 'gifsicle' }] }
            );
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
                        'file://' +
                        pathModule.resolve(__dirname, '..', 'testdata') +
                        '/',
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
                        operations: [
                            { name: 'resize', args: [10, 10], engineName: 'gm' }
                        ]
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

        it.skip('should refuse to resize an image to exceed the max number of pixels, gm', function() {
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
    });
});
