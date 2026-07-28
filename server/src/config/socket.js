import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from './config.js';
import logger from '../middleware/logger.js';

let io = null;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for dev/sandbox compatibility
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication Middleware for socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        // Allow unauthenticated sockets to connect (e.g. for general monitoring), but they won't join private rooms
        return next();
      }

      jwt.verify(token, config.jwt.accessSecret, (err, decoded) => {
        if (err) {
          logger.warn(`Socket authentication failed: ${err.message}`);
          return next();
        }
        socket.user = decoded;
        next();
      });
    } catch (err) {
      logger.error('Error in socket auth handshake middleware:', err);
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    // If authenticated, join rooms according to roles
    if (socket.user) {
      const { id: userId, role } = socket.user;
      
      if (role === 'ADMIN' || role === 'AUDITOR') {
        socket.join('admin');
        logger.info(`Socket client ${socket.id} (Admin ID: ${userId}) joined 'admin' room`);
      } else if (role === 'MERCHANT') {
        socket.join(`merchant_${userId}`);
        logger.info(`Socket client ${socket.id} joined 'merchant_${userId}' room`);
      } else if (role === 'CUSTOMER') {
        socket.join(`customer_${userId}`);
        logger.info(`Socket client ${socket.id} joined 'customer_${userId}' room`);
      }
    }

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => io;

export const emitToRoom = (room, event, payload) => {
  if (io) {
    io.to(room).emit(event, payload);
  }
};

export const emitToAll = (event, payload) => {
  if (io) {
    io.emit(event, payload);
  }
};
