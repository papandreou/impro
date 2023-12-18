const childProcess = require('child_process');
const Stream = require('stream');

const debug = require('./debug');

function noopFilterStderr() {
  return true;
}

module.exports = class StdinoutStream extends Stream.Transform {
  constructor(name, binary, args, options) {
    super();

    this.args = args;
    this.binary = binary;
    this.errorline = null;
    this.filterStderr = null;
    this.logger = null;
    this.process = null;
    this.hasEnded = false;
    this.hasErrored = false;
    this.hasOutput = false;

    this.logger = debug(name);

    options = options || {};
    if (typeof options.filterStderr === 'function') {
      this.filterStderr = options.filterStderr;
    } else {
      this.filterStderr = noopFilterStderr;
    }
  }

  // implementation local methods

  __cleanUp() {
    if (this.process) {
      this.hasEnded = true;
      this.process.kill();
      return false;
    } else if (!this.hasOutput) {
      this.hasOutput = true; // set condition for reentrancy
      return this.__error('stream ended without emitting any data');
    } else {
      this.hasEnded = true;
      return true;
    }
  }

  __error(messageOrError) {
    if (this.hasErrored) {
      return;
    }

    const error =
      typeof messageOrError === 'string'
        ? new Error(`${this.logger.namespace}: ${messageOrError}`)
        : messageOrError;

    this.errorline = null;
    this.hasErrored = true;
    this.emit('error', error);
    this.__cleanUp();

    return false;
  }

  __execCommand() {
    const onSpawned = (process) => {
      this.process = process;

      if (this.hasEnded) {
        return;
      }

      const boundError = (errorPrefix) => (messageOrError) => {
        messageOrError =
          typeof messageOrError !== 'string'
            ? messageOrError.message
            : messageOrError;
        let errorSuffix;
        if (!this.errorline && !this.logger.enabled) {
          errorSuffix = messageOrError;
        } else if (!this.errorline) {
          errorSuffix = messageOrError;
        } else {
          errorSuffix = `${messageOrError} (${this.errorline.trimEnd()})`;
        }
        return this.__error(`[${errorPrefix}] ${errorSuffix}`);
      };

      const processError = boundError('PROCESS');
      const stdinError = boundError('STDIN');
      const stdoutError = boundError('STDOUT');

      const decodeStderr = (line) => {
        let errorMessage;
        try {
          errorMessage = line.toString();
        } catch (e) {
          return 'undecodeable output on stderr';
        }
        if (!errorMessage) {
          // empty line output on stderr => ignore
          return null;
        } else if (!this.filterStderr(errorMessage)) {
          // filter indicated a non-error => ignore
          return null;
        }
        return errorMessage;
      };

      this.process.stderr.on('data', (line) => {
        if (this.errorline !== null) {
          // ignore
        } else if ((this.errorline = decodeStderr(line)) !== null) {
          this.hasErrored = true;
        }
      });

      this.process.stdin.on('error', stdinError);

      this.process.stdout
        .on('error', stdoutError)
        .on('readable', () => {
          if (this.hasEnded) {
            return;
          }

          this.hasOutput = true;

          let chunk;
          while ((chunk = this.process.stdout.read()) !== null) {
            this.push(chunk);
          }
        })
        .on('end', () => {
          if (!this.hasEnded) {
            if (this.process) {
              // stdout closed before the process exited
              // therefore record a marker that this is the case
              // and wait until the process itself shuts downs
              this.logger('STDOUT: early close');
              this.hasEnded = true;
            } else {
              this.__error('stream ended outputting prematurely');
            }
          }
        });

      // exit
      this.process.on('error', (err) => {
        if (err.code === 'ENOENT') {
          this.errorline = err.message;
        }
        processError('unable to execute binary');
      });
      this.process.on('exit', (exitCode) => {
        this.process = null;

        if (this.hasErrored || exitCode === null) {
          exitCode = -1;
          this.hasErrored = false; // force error handling to occur
        }

        this.logger(`PROCESS: exit code ${0} and hasEnded=${this.hasEnded}`);

        if (exitCode !== 0) {
          processError(`exited with code ${exitCode}`);
        } else if (this.__cleanUp()) {
          this.logger('PROCESS: pushing final chunk on exit code 0');
          this.push(null);
        }
      });
    };
    try {
      const spawned = this.__spawnBinary(this.args);
      onSpawned(spawned);
    } catch (err) {
      this.__error(err);
    }
  }

  __spawnBinary(spawnArgs) {
    if (this.binary) {
      return childProcess.spawn(this.binary, spawnArgs);
    } else {
      throw new Error('Unable to locate the gifsicle binary file.');
    }
  }

  // implementation stream methods

  _transform(chunk, encoding, cb) {
    if (this.hasEnded) return;
    if (!this.process) this.__execCommand();
    this.process.stdin.write(chunk);
    cb();
  }

  _destroy() {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.hasOutput = true; // set condition for reentrancy
    this.__cleanUp();
  }

  // implementation hook methods

  end(chunk) {
    if (chunk !== undefined) {
      this.write(chunk);
    }

    if (this.process) {
      this.process.stdin.end();
    } else {
      this.__cleanUp();
    }
  }

  on(type, callback) {
    if (type === 'data') {
      type = 'readable';
      callback = ((ondata) => {
        return function onreadable() {
          let chunk;
          while ((chunk = this.read()) !== null) {
            ondata(chunk);
          }
        };
      })(callback);
    }
    Stream.Readable.prototype.on.call(this, type, callback);
    return this;
  }

  pause() {
    if (this.process) {
      this.process.stdout.pause();
    }
    this.isPaused = true;
  }

  resume() {
    if (this.process) {
      this.process.stdout.resume();
    }
    this.isPaused = false;
  }
};
