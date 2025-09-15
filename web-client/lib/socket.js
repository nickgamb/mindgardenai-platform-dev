import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

export const connectSocket = () => {
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) socket.disconnect();
};

export default socket;