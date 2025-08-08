'use strict';

const ApiError = require('./ApiError');

class MissingParamsError extends ApiError {
  constructor() {
    super();
    this.errorCode = 413;
    this.errorMessage = "缺失参数";
  }
}

module.exports = MissingParamsError;
