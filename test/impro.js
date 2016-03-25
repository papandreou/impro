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

expect.addAssertion('<string> when piped through <Stream> <assertion?>', function (expect, subject) {
    return expect.apply(expect, [load(subject), 'when piped through'].concat(Array.prototype.slice.call(arguments, 2)));
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

    it('should derive the metadata of an image', function () {
        return expect(
            'turtle.jpg',
            'when piped through',
            impro().metadata(),
            'to yield output satisfying when decoded as', 'utf-8',
            'when passed as parameter to', JSON.parse, 'to satisfy', {
                contentType: 'image/jpeg'
            }
        );
    });

    it('should run an image through optipng', function () {
        return expect(
            'testImage.png',
            'when piped through',
            impro().add({ name: 'optipng', args: [ '-o7' ]}),
            'to yield output satisfying to have length', 149
        );
    });
});
