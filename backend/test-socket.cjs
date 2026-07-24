const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

console.log('Connecting to socket.io...');

socket.on('connect', () => {
  console.log('Connected! ID:', socket.id);
});

socket.on('network:update', (data) => {
  console.log('Received network:update!', {
    timestamp: data.timestamp,
    devicesCount: data.devices?.length,
    metrics: data.metrics
  });
  
  // Test completed, exit
  process.exit(0);
});

setTimeout(() => {
  console.error('Timed out waiting for network:update');
  process.exit(1);
}, 20000); // 20s timeout
