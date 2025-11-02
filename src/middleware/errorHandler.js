import { NODE_ENV } from "../config/environment.js";

class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error("❌ Error:", err);

  // Handle Mongoose bad ObjectId (CastError)
  if (err.name === "CastError") {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Handle Mongoose duplicate key (unique index violation)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue);
    const message = `Duplicate value for field(s): ${fields.join(", ")}`;
    error = new ErrorResponse(message, 400);
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));

    error = new ErrorResponse("Validation failed", 400);
    error.details = errors;
  }


  // Send unified error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    errors: error.details || null,
    ...(NODE_ENV === "development" && { stack: err.stack }),
  });

};

export { ErrorResponse, errorHandler };
