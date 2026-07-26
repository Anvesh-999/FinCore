import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { AppError } from './error.js';

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('UNAUTHORIZED', 'Access token is required', 401));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
      };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('TOKEN_EXPIRED', 'Access token has expired', 401));
      }
      return next(new AppError('UNAUTHORIZED', 'Access token is invalid', 401));
    }
  } catch (err) {
    next(err);
  }
};

export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'FORBIDDEN',
          'You do not have permission to perform this action',
          403
        )
      );
    }
    next();
  };
};
