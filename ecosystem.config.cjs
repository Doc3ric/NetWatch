module.exports = {
  apps: [
    {
      name: 'netwatch-backend',
      script: 'dist/server.js',
      cwd: 'C:\\NETWATCH\\backend',
    },
    {
      name: 'netwatch-agent',
      script: 'dist/index.js',
      cwd: 'C:\\NETWATCH\\agent',
    },
    {
      name: 'netwatch-web',
      script: 'server.js',
      cwd: 'C:\\NETWATCH\\web',
    },
  ],
};
