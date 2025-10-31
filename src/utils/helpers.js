import jwt from 'jsonwebtoken';
import { JWT_EXPIRE, JWT_SECRET } from "../config/environment.js";

export const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

export const formatResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data,
  };
};
