function requireOr(id, defaultValue) {
  try {
    return module.parent.require(id);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
    return defaultValue;
  }
}

module.exports = requireOr;
module.exports.requireOr = requireOr;
