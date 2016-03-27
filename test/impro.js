var expect = require('unexpected').clone()
    .use(require('unexpected-stream'))
    .use(require('unexpected-image'))
    .use(require('unexpected-resemble'));

var Impro = require('../');
var impro = Impro;

var memoizeSync = require('memoizesync');
var pathModule = require('path');
var fs = require('fs');
var load = memoizeSync(function (fileName) {
    return fs.readFileSync(pathModule.resolve(__dirname, '..', 'testdata', fileName));
});

expect.addAssertion('<string> when piped through <Stream> <assertion?>', function (expect, subject, ...rest) {
    expect.errorMode = 'nested';
    return expect(load(subject), 'when piped through', ...rest);
});

expect.addAssertion('<Stream> to yield JSON output satisfying <any>', function (expect, subject, value) {
    return expect(subject, 'to yield output satisfying when decoded as', 'utf-8', 'when passed as parameter to', JSON.parse, 'to satisfy', value);
});

describe('Impro', function () {
    it('should return a new instance', function () {
        expect(new Impro(), 'to be an', Impro);
    });

    describe('#parse', function () {
        it('should return an object with the operations and the leftover parameters, given a query string', function () {
            expect(new Impro().parse('foo=bar&resize=120,120'), 'to equal', {
                operations: [
                    { name: 'resize', args: [ 120, 120 ] }
                ],
                leftover: 'foo=bar'
            });
        });
    });

    describe('when passed a query string', function () {
        it('should return a duplex stream that executes the processing instructions', function () {
            return expect(
                'turtle.jpg',
                'when piped through',
                impro('resize=40,15&crop=center'),
                'to yield output satisfying to resemble',
                load('turtleCroppedCenter.jpg')
            );
        });
    });

    describe('when passed an array of operation objects', function () {
        it('should return a duplex stream that executes the processing instructions', function () {
            return expect(
                'turtle.jpg',
                'when piped through',
                impro([
                    { name: 'resize', args: [ 40, 15 ] },
                    { name: 'crop', args: [ 'center' ] }
                ]),
                'to yield output satisfying to resemble',
                load('turtleCroppedCenter.jpg')
            );
        });
    });

    describe('when adding the processing instructions via individual method calls', function () {
        it('should return a duplex stream that executes the processing instructions', function () {
            return expect(
                'turtle.jpg',
                'when piped through',
                impro().resize(40, 15).crop('center'),
                'to yield output satisfying to resemble',
                load('turtleCroppedCenter.jpg')
            );
        });
    });

    describe('when given a source content type', function () {
        it('should default to output an image of the same type', function () {
            return expect(impro().sourceType('image/jpeg').resize(40, 15).crop('center'), 'to satisfy', {
                targetContentType: 'image/jpeg'
            });
        });

        it('should honor an explicit type conversion', function () {
            return expect(impro().sourceType('image/jpeg').gif(), 'to satisfy', {
                targetContentType: 'image/gif'
            });
        });
    });

    it('should allow an image engine to be explicitly selected', function () {
        return expect(
            'turtle.jpg',
            'when piped through',
            impro().gm().resize(40, 15).crop('center'),
            'to yield output satisfying to resemble',
            load('turtleCroppedCenterGm.jpg')
        );
    });

    it('should not provide a targetContentType when no source content type is given and no explicit conversion has been performed', function () {
        return expect(impro().resize(40, 15).crop('center'), 'to satisfy', {
            targetContentType: undefined
        });
    });

    describe('#metadata', function () {
        it('should produce the metadata of an image as JSON', function () {
            return expect(
                'turtle.jpg',
                'when piped through',
                impro().metadata(),
                'to yield output satisfying when decoded as', 'utf-8',
                'when passed as parameter to', JSON.parse, 'to satisfy', {
                    contentType: 'image/jpeg',
                    // filesize: 105836,
                    // etag: /^W\//,
                    width: 481,
                    height: 424,
                    space: 'srgb',
                    channels: 3,
                    hasProfile: false,
                    hasAlpha: false
                }
            );
        });

        it('should allow retrieving the metadata of a non-image file with a non-image extension', function () {
            return expect(
                'something.txt',
                'when piped through',
                impro().sourceType('text/plain; charset=UTF-8').metadata(),
                'to yield JSON output satisfying', {
                    error: 'Input buffer contains unsupported image format',
                    contentType: 'text/plain; charset=UTF-8'
                    // filesize: 4,
                    // etag: expect.it('to be a string')
                }
            );
        });

        it('should set animated:true for an animated gif', function () {
            return expect(
                'animated.gif',
                'when piped through',
                impro().metadata(),
                'to yield JSON output satisfying', {
                    animated: true
                }
            );
        });

        it('should set animated:false for a non-animated gif', function () {
            return expect(
                'bulb.gif',
                'when piped through',
                impro().metadata(),
                'to yield JSON output satisfying', {
                    animated: false
                }
            );
        });
    });

    it('should run an image through optipng', function () {
        return expect(
            'testImage.png',
            'when piped through',
            impro().add({ name: 'optipng', args: [ '-o7' ]}),
            'to yield output satisfying to have length', 149
        );
    });

    describe('with the gifsicle engine', function () {
        it('should handle resize before extract', function () {
            return expect(
                'cat.gif',
                'when piped through',
                impro.gifsicle().resize(380, 486).extract(150, 150, 100, 100)),
                'to yield output satisfying',
                expect.it('to have metadata satisfying', {
                    size: { width: 100, height: 100 },
                    Scene: '3 of 4' // Animated
                }).and('to resemble', load('cat-resized-then-cropped.gif')
            );
        });

        it('should prefer gifsicle for processing gifs', function () {
            return expect(
                impro.sourceType('gif').resize(10, 10).flush(),
                'to satisfy',
                { _streams: [ expect.it('to be a', require('gifsicle-stream')) ] }
            );
        });
    });

    describe('with the inkscape engine', function () {
        it('should convert to png by default', function () {
            return expect(
                'dialog-information.svg',
                'when piped through',
                impro.sourceType('svg').inkscape(),
                'to yield output satisfying to resemble',
                load('dialog-information.png')
            );
        });

        it('should convert to png explicitly', function () {
            return expect(
                'dialog-information.svg',
                'when piped through',
                impro.sourceType('svg').inkscape().png(),
                'to yield output satisfying to resemble',
                load('dialog-information.png')
            );
        });

        it('should convert to pdf', function () {
            return expect(
                'dialog-information.svg',
                'when piped through',
                impro.sourceType('svg').inkscape().pdf(),
                'to yield output satisfying', 'when decoded as', 'utf-8',
                'to match', /^%PDF-1\.4/
            );
        });

        it('should convert to eps', function () {
            return expect(
                'dialog-information.svg',
                'when piped through',
                impro.sourceType('svg').inkscape().eps(),
                'to yield output satisfying', 'when decoded as', 'utf-8',
                'to match', /^%!PS-Adobe-3.0/
            );
        });
    });
});
