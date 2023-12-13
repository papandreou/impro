const expect = require('./expect');
const fs = require('fs');
const gifsicleBinPath = require('gifsicle');
const pathModule = require('path');
const sinon = require('sinon');

const StdinoutStream = require('../src/StdinoutStream');

const TESTDATA = pathModule.join(__dirname, '..', 'testdata');

const consumeStreamAs = (stream, as) => {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream
      .on('error', (e) => reject(e))
      .on('end', () => resolve(Buffer.concat(chunks)));

    switch (as) {
      case 'streams2':
        stream.on('data', (chunk) => chunks.push(chunk));
        break;
      case 'streams3':
        stream.on('readable', () => {
          let chunk;
          while ((chunk = stream.read()) !== null) {
            chunks.push(chunk);
          }
        });
        break;
      default:
        reject(new Error('unknown event'));
    }
  });
};

const loadAsBuffer = async (fileName) =>
  await fs.promises.readFile(pathModule.join(TESTDATA, fileName));

const loadAsStream = (fileName) =>
  fs.createReadStream(pathModule.join(TESTDATA, fileName));

describe('StdinoutStream', () => {
  const binPath = gifsicleBinPath;

  afterEach(() => {
    sinon.restore();
  });

  it('should process a valid file as a streams2', async () => {
    const stream = new StdinoutStream('Test', binPath, ['--interlace']);

    await loadAsStream('bulb.gif').pipe(stream);

    const actualBuffer = await consumeStreamAs(stream, 'streams2');
    const expectedBuffer = await loadAsBuffer('bulbInterlaced.gif');

    expect(actualBuffer, 'to equal', expectedBuffer);
  });

  it('should process a valid file as a streams3', async () => {
    const stream = new StdinoutStream('Test', binPath, ['--interlace']);

    await loadAsStream('bulb.gif').pipe(stream);

    const actualBuffer = await consumeStreamAs(stream, 'streams3');
    const expectedBuffer = await loadAsBuffer('bulbInterlaced.gif');

    expect(actualBuffer, 'to equal', expectedBuffer);
  });

  it('should error on a missing binary', async () => {
    const stream = new StdinoutStream('Test', '/nonexistent', ['--interlace']);

    await loadAsStream('testImage.png').pipe(stream);

    try {
      await consumeStreamAs(stream, 'streams2');
    } catch (e) {
      return expect(
        e.message,
        'to start with',
        'Test: [PROCESS] unable to execute binary'
      );
    }
    expect.fail('stream did not error');
  });

  it('should error on an empty file', async () => {
    const stream = new StdinoutStream('Test', binPath, ['--interlace']);

    await loadAsStream('empty.gif').pipe(stream);

    try {
      await consumeStreamAs(stream, 'streams2');
    } catch (e) {
      return expect(
        e,
        'to have message',
        'Test: stream ended without emitting any data'
      );
    }
    expect.fail('stream did not error');
  });

  it('should error on an invalid file', async () => {
    const stream = new StdinoutStream('Test', binPath, ['--interlace']);

    await loadAsStream('testImage.png').pipe(stream);

    try {
      await consumeStreamAs(stream, 'streams2');
    } catch (e) {
      return expect(
        e.message,
        'to start with',
        'Test: [PROCESS] exited with code -1'
      );
    }
    expect.fail('stream did not error');
  });

  it('should error and correctly teardown after the child starts', async () => {
    const stream = new StdinoutStream('Test', binPath, ['--interlace']);
    const spawnBinaryPromise = new Promise((resolve) => {
      stream.__spawnBinary = ((originalMethod) => {
        return function (...args) {
          setImmediate(() => resolve());
          return originalMethod.apply(this, args);
        };
      })(stream.__spawnBinary);
    });

    const consumePromise = consumeStreamAs(stream, 'streams2');
    await loadAsStream('testImage.png').pipe(stream);

    try {
      await spawnBinaryPromise;
      stream.destroy();
      await consumePromise;
    } catch (e) {
      return expect(
        e.message,
        'to start with',
        'Test: [PROCESS] exited with code -1'
      );
    }
    expect.fail('stream did not error');
  });
});
