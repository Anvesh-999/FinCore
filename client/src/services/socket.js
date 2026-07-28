import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  if (socket) return socket;
  
  // Connect to the base origin host dynamically
  socket = io(window.location.origin, {
    auth: {
      token
    },
    transports: ['websocket', 'polling']
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
