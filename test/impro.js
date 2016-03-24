var expect = require('unexpected')
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
                load('turtle.jpg'),
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
                load('turtle.jpg'),
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
                load('turtle.jpg'),
                'when piped through',
                impro().resize(40, 15).crop('center'),
                'to yield output satisfying to resemble',
                load('turtleCroppedCenter.jpg')
            );
        });
    });

    describe('when given a source content type', function () {
        it('should default to output an image of the same type', function () {
            return expect(impro({ contentType: 'image/jpeg' }).resize(40, 15).crop('center').targetContentType, 'to equal', 'image/jpeg');
        });

        it('should honor an explicit type conversion', function () {
            return expect(impro({ contentType: 'image/jpeg' }).gif().targetContentType, 'to equal', 'image/gif');
        });
    });

    it('should not provide a targetContentType when no source content type is given and no explicit conversion has been performed', function () {
        return expect(impro().resize(40, 15).crop('center').targetContentType, 'to be undefined');
    });
});
