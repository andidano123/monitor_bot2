'use strict';

const configApiError = require('./ErrorConstant');

class ApiError extends Error {
  constructor(code, log = false) {
    super();
    if (code) {
      this.errorCode = code;
    }
    if (log) {
      this.log = true;
    }
    this.errorMessage = configApiError[this.errorCode];
  }

  static createErrorBody(code = 2, message = '') {
    return {
      code: code || 2,
      data: {},
      message: message || configApiError[code] || configApiError[2],
    };
  }
}

module.exports = ApiError;
