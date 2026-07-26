import authService from './service.js';
import logger from '../../middleware/logger.js';

// Helper to configure cookie options for security
const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching JWT expiration
  };
};

export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    logger.info(`User registered successfully: ${user.email} with role: ${user.role}`);
    
    res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    logger.info(`User logged in: ${user.email} (Role: ${user.role})`);

    // Set refresh token in httpOnly secure cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      success: true,
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    // Check if refresh token is in cookies or request body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const { accessToken } = await authService.refresh(refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie('refreshToken', getCookieOptions());
    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await authService.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};
