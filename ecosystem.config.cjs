module.exports = {
  apps: [
    {
      name: 'netwatch-backend',
      script: 'start-backend.bat',
      cwd: 'C:\\NETWATCH',
      interpreter: 'cmd.exe',
    },
    {
      name: 'netwatch-agent',
      script: 'start-agent.bat',
      cwd: 'C:\\NETWATCH',
      interpreter: 'cmd.exe',
    },
    {
      name: 'netwatch-web',
      script: 'start-web.bat',
      cwd: 'C:\\NETWATCH',
      interpreter: 'cmd.exe',
    },
  ],
};
