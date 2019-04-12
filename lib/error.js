class statusError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    this.status = status || 500;
  }
}

class FormError extends statusError {
  constructor(message, status) {
    super(message, status);
  }
}

class DataError extends statusError {
  constructor(message, status) {
    super(message, status);
  }
}

class TravelerError extends statusError {
  constructor(message, status) {
    super(message, status);
  }
}

module.exports = {
  statusError: statusError,
  FormError: FormError,
  DataError: DataError,
  TravelerError: TravelerError,
};
