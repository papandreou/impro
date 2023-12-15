class OutputDimensionsExceeded extends Error {
  constructor(...args) {
    super(...args);
    this.name = 'OutputDimensionsExceeded';
    this[this.name] = true; // createerror compatiblity
  }
}

exports.OutputDimensionsExceeded = OutputDimensionsExceeded;
