const expect = require('unexpected');

const Pipeline = require('../src/Pipeline');

describe('Pipeline', () => {
  let fakeImpro;

  beforeEach(() => {
    fakeImpro = {
      engineByName: {}
    };
  });

  it('should allow disabling engines from the constructor', () => {
    fakeImpro.engineByName.foo = {};
    fakeImpro.engineByName.bar = {};

    const pipeline = new Pipeline(fakeImpro, { engines: { foo: false } });

    expect(pipeline.isDisabledByEngineName, 'to equal', {
      foo: true,
      bar: false
    });
  });

  it('should throw on a relative svgAssetPath', () => {
    expect(
      () =>
        new Pipeline(fakeImpro, {
          supportedOptions: ['svgAssetPath'],
          svgAssetPath: './'
        }),
      'to throw',
      'Pipeline: svgAssetPath must be absolute'
    );
  });

  describe('#_attach', () => {
    it('should throw for a non-stream', () => {
      const pipeline = new Pipeline(fakeImpro);

      expect(
        () => pipeline._attach(null),
        'to throw',
        'Cannot attach something that is not a stream'
      );
    });
  });

  describe('#add', () => {
    it('should error on an invalid operation - null', () => {
      const pipeline = new Pipeline(fakeImpro);

      expect(
        () => {
          pipeline.add(null);
        },
        'to throw',
        'add: Unsupported argument: null'
      );
    });

    it('should error on an invalid operation - {}', () => {
      const pipeline = new Pipeline(fakeImpro);

      expect(
        () => {
          pipeline.add({});
        },
        'to throw',
        'add: Unsupported argument: {}'
      );
    });

    it('should error adding an operation while streaming', () => {
      const pipeline = new Pipeline(fakeImpro);
      pipeline._flushed = true;

      expect(
        () => {
          pipeline.add(null);
        },
        'to throw',
        'Cannot add more operations after the streaming has begun'
      );
    });

    it('should error adding an operation after adding a stream', () => {
      const pipeline = new Pipeline(fakeImpro);
      pipeline._preflush = true;

      expect(
        () => {
          pipeline.add(null);
        },
        'to throw',
        'Cannot add non-streams after calling addStream()'
      );
    });
  });
});
