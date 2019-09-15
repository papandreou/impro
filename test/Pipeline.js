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
});
