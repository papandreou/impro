module.exports = function requireOr(id) {
  try {
    return module.parent.require(id);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }
};
