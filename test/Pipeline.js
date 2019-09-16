const expect = require('unexpected');

const Pipeline = require('../src/Pipeline');

describe('Pipeline', () => {
    describe('#_attach', () => {
        it('should throw for a non-stream', () => {
            const pipeline = new Pipeline({});

            expect(
                () => pipeline._attach(null),
                'to throw',
                'Cannot attach something that is not a stream'
            );
        });
    });

    describe('#add', () => {
        it('should error on an invalid operation - null', () => {
            const pipeline = new Pipeline({});

            expect(
                () => {
                    pipeline.add(null);
                },
                'to throw',
                'add: Unsupported argument: null'
            );
        });

        it('should error on an invalid operation - {}', () => {
            const pipeline = new Pipeline({});

            expect(
                () => {
                    pipeline.add({});
                },
                'to throw',
                'add: Unsupported argument: {}'
            );
        });

        it('should error adding an operation while streaming', () => {
            const pipeline = new Pipeline({});
            pipeline._flushed = true;

            expect(
                () => {
                    pipeline.add(null);
                },
                'to throw',
                'Cannot add more operations after the streaming has begun'
            );
        });
    });
});
