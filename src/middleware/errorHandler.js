import { NODE_ENV } from "../config/environment.js";

// Custom Error Class
class ErrorResponse extends Error {
  constructor(message, statusCode, errorDetails = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = errorDetails;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global Error Handler Middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Console Log (development only)
  if (NODE_ENV === "development") {
    console.error("❌ Error Stack:", err.stack);
    console.error("❌ Error Details:", err.details);
  } else {
    console.error("❌ Error:", err.message);
  }

  // Handle Mongoose bad ObjectId (CastError)
  if (err.name === "CastError") {
    const message = `Resource not found with id: ${err.value}`;
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

  // JWT / Auth Errors (optional but helpful)
  if (err.name === "JsonWebTokenError") {
    error = new ErrorResponse("Invalid token, authorization denied", 401);
  }

  if (err.name === "TokenExpiredError") {
    error = new ErrorResponse("Token expired, please log in again", 401);
  }

  // FIX: Preserve the details from ErrorResponse
  if (err.details) {
    error.details = err.details;
  }

  // Send unified error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    errors: {
      details: error.details || null,
    },
    ...(NODE_ENV === "development" && { stack: err.stack }),
  });
};

export { ErrorResponse, errorHandler };