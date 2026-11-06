'use strict';

/**
 * The one error type routes throw on purpose. status and code reach the
 * visitor; anything else that is thrown becomes a plain 500 (core/router.js).
 */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

module.exports = { HttpError };
