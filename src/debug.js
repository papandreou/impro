const IS_DEBUG = /^(?:1|true|on|yes)$/i.test(process.env.DEBUG);

function noop() {}

class DebugLogger {
  constructor(namespace, _log) {
    this.namespace = namespace;
    this.log = _log || noop;
  }

  extend(namespace) {
    const extendedName = [this.name, namespace].join(':');
    return new DebugLogger(extendedName);
  }

  format(msg) {
    return `${this.namespace}: ${msg}`;
  }

  static createLogger(namespace) {
    const _log = IS_DEBUG && console.warn;
    const debugLogger = new DebugLogger(namespace, _log);
    const logger = (msg) => debugLogger.log(debugLogger.format(msg));
    logger.extend = (namespace) => debugLogger.extend(namespace);
    Object.defineProperty(logger, 'enabled', {
      get: () => IS_DEBUG,
    });
    Object.defineProperty(logger, 'namespace', {
      get: () => debugLogger.namespace,
    });
    return logger;
  }
}

module.exports = DebugLogger.createLogger;
