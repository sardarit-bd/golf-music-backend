import jwt from 'jsonwebtoken';
import User from '../models/model.user.js';
import { JWT_SECRET } from '../config/environment.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check if Authorization header has Bearer token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id);

      // If user not found
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication',
    });
  }
};


export const authorize = (...roles) => {
  return (req, res, next) => {

    const userRole = req.user?.userType;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'User role not found or unauthorized'
      });
    }


    if (userRole === 'admin' || roles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `User role "${userRole}" is not authorized to access this route`
    });
  };
};



