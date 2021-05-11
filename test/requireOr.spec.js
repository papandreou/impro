const expect = require('unexpected');
const pathModule = require('path');

const requireOr = require('../src/requireOr');

const testDataPath = pathModule.resolve(__dirname, '..', 'testdata');

describe('requireOr', () => {
  it('should return a valid module', () => {
    expect(requireOr('unexpected'), 'to equal', expect);
  });

  it('should return undefined on an invalid module', () => {
    expect(requireOr('nonexistent'), 'to be undefined');
  });

  it('should rethrow any other errors', () => {
    expect(
      () => requireOr(`${testDataPath}/badModule`),
      'to throw',
      new Error('bad_module')
    );
  });
});
