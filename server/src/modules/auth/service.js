import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../config/config.js';
import authRepository from './repository.js';
import { AppError } from '../../middleware/error.js';

export class AuthService {
  async register({ firstName, lastName, email, password, role }) {
    if (!firstName || !lastName || !email || !password || !role) {
      throw new AppError('VALIDATION_ERROR', 'All fields (firstName, lastName, email, password, role) are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await authRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'A user with this email address already exists', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await authRepository.createUser({
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      role
    });

    return newUser;
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email address or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email address or password', 401);
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    const refreshToken = jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new AppError('UNAUTHORIZED', 'Refresh token is required', 401);
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const user = await authRepository.findById(decoded.id);
      
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Session user no longer exists', 401);
      }

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      };

      const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry,
      });

      return { accessToken };
    } catch (err) {
      throw new AppError('UNAUTHORIZED', 'Refresh token is invalid or expired', 401);
    }
  }

  async getUserById(id) {
    const user = await authRepository.findById(id);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User session could not be retrieved', 404);
    }
    return user;
  }
}

export default new AuthService();
