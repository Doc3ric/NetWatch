'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Activity, Globe2, Router, Laptop, MoreVertical, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState<any>({
    status: null,
    metrics: [],
    devices: [],
    alerts: []
  });
  const [timeRange, setTimeRange] = useState('1h');
  const [isTesting, setIsTesting] = useState(false);

  // Initial Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const [statusRes, metricsRes, devicesRes, alertsRes] = await Promise.all([
          fetch(`${backendUrl}/api/status`).then(res => res.json()),
          fetch(`${backendUrl}/api/metrics?range=${timeRange}`).then(res => res.json()),
          fetch(`${backendUrl}/api/devices`).then(res => res.json()),
          fetch(`${backendUrl}/api/alerts?resolved=false`).then(res => res.json())
        ]);
        
        setData({
          status: statusRes,
          metrics: metricsRes.reverse(), // Ensure oldest first for recharts
          devices: devicesRes,
          alerts: alertsRes
        });
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };
    fetchData();
  }, [timeRange]);

  // Socket Live Updates
  useEffect(() => {
    if (!socket) return;
    
    const handleUpdate = (update: any) => {
      if (update.type === 'speedtest_result') {
        setIsTesting(false);
        setData((prev: any) => {
          const newMetrics = [...prev.metrics];
          if (newMetrics.length > 0) {
            newMetrics[newMetrics.length - 1] = {
              ...newMetrics[newMetrics.length - 1],
              ...update.metrics
            };
          }
          return { ...prev, metrics: newMetrics };
        });
        return;
      }

      setData((prev: any) => {
        // Prepend new metric, keep length bounded if needed, though timeRange limits it
        const newMetrics = [...prev.metrics, update.metrics].slice(-100); 
        return {
          ...prev,
          devices: update.devices, // overwrite with latest
          metrics: newMetrics,
          status: { ...prev.status, network: { totalDevices: update.devices.length, onlineDevices: update.devices.filter((d:any)=>d.status==='online').length } }
        };
      });
    };

    socket.on('network:update', handleUpdate);
    return () => {
      socket.off('network:update', handleUpdate);
    };
  }, [socket]);

  const latestMetric = data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;

  return (
    <div className="space-y-6">
      
      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* System Status Card */}
        <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">System Status</h2>
            <button className="text-text-muted hover:text-text"><MoreVertical className="w-5 h-5" /></button>
          </div>
          
          <div className="grid grid-cols-2 gap-y-6">
            <div>
              <p className="text-sm text-text-muted mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span className="font-semibold text-lg text-primary">Online</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">ISP Provider</p>
              <p className="font-semibold text-lg">Quantum Fiber</p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">Gateway IP</p>
              <p className="font-mono text-sm text-text-muted">192.168.1.1</p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">System Uptime</p>
              <p className="font-mono text-sm text-text-muted">14d 2h 45m</p>
            </div>
          </div>
          
          <Globe2 className="absolute -right-6 -bottom-6 w-32 h-32 text-border opacity-20" />
        </div>

        {/* Current Performance Card */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">Current Performance</h2>
            <button 
              onClick={async () => {
                if (isTesting) return;
                setIsTesting(true);
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
                await fetch(`${backendUrl}/api/speedtest/trigger`, { method: 'POST' });
              }}
              disabled={isTesting}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${isTesting ? 'bg-surface-hover text-text-muted cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            >
              {isTesting ? 'Running...' : 'Run Speed Test'}
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-4 h-full">
            <div className="flex flex-col">
              <div className="text-text-muted mb-2"><Activity className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Ping</p>
              <p className="text-xl font-semibold">{latestMetric?.pingMs ? Math.round(latestMetric.pingMs) : '--'}ms</p>
            </div>
            <div className="flex flex-col">
              <div className="text-primary mb-2"><ArrowDownRight className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Download</p>
              <p className="text-xl font-semibold text-primary">{latestMetric?.downloadMbps ? latestMetric.downloadMbps.toFixed(1) : '--'} Mbps</p>
            </div>
            <div className="flex flex-col">
              <div className="text-primary mb-2"><ArrowUpRight className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Upload</p>
              <p className="text-xl font-semibold text-primary">{latestMetric?.uploadMbps ? latestMetric.uploadMbps.toFixed(1) : '--'} Mbps</p>
            </div>
            <div className="flex flex-col">
              <div className="text-danger mb-2"><AlertTriangle className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Packet Loss</p>
              <p className="text-xl font-semibold">{latestMetric?.packetLossPct ? Math.round(latestMetric.packetLossPct) : '0'}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">Latency (MS)</h2>
            <div className="flex gap-2 text-xs font-medium bg-background rounded-md p-1 border border-border">
              {['1h', '24h', '7d', '30d'].map(range => (
                <button 
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded ${timeRange === range ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.metrics}>
                <defs>
                  <linearGradient id="colorPing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#94A3B8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3441" vertical={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151A22', borderColor: '#2A3441', color: '#E2E8F0' }}
                  itemStyle={{ color: '#E2E8F0' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Area type="monotone" dataKey="pingMs" stroke="#94A3B8" fillOpacity={1} fill="url(#colorPing)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">Bandwidth Usage</h2>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-primary"></span> DL</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-500"></span> UL</span>
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.metrics}>
                <defs>
                  <linearGradient id="colorDl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C896" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00C896" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3441" vertical={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151A22', borderColor: '#2A3441', color: '#E2E8F0' }}
                />
                <Area type="monotone" dataKey="downloadMbps" stroke="#00C896" fillOpacity={1} fill="url(#colorDl)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connected Devices */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">Connected Devices</h2>
            <a href="/devices" className="text-sm font-medium text-text hover:text-primary transition-colors">View All</a>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="text-xs uppercase tracking-wider border-b border-border text-text-muted">
                <tr>
                  <th className="px-2 py-3 font-medium">Name</th>
                  <th className="px-2 py-3 font-medium">IP Address</th>
                  <th className="px-2 py-3 font-medium">MAC</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium text-right">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.devices.slice(0,5).map((device: any) => (
                  <tr key={device.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3 text-text">
                        {device.type === 'router' ? <Router className="w-4 h-4 text-text-muted" /> : <Laptop className="w-4 h-4 text-text-muted" />}
                        <span className="truncate max-w-[120px]">{device.vendor || device.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 font-mono">{device.ip}</td>
                    <td className="px-2 py-3 font-mono text-xs">{device.mac}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-primary' : 'bg-text-muted'}`}></span>
                        <span className={device.status === 'online' ? 'text-text' : 'text-text-muted'}>
                          {device.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-primary font-mono text-xs">-- GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          
          {/* Topology */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-6">Topology</h2>
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-0 w-full h-px bg-border -z-10"></div>
              
              <div className="flex flex-col items-center bg-surface p-2">
                <div className="w-10 h-10 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center mb-2">
                  <Globe2 className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase">WAN</span>
              </div>
              
              <div className="flex flex-col items-center bg-surface p-2">
                <div className="w-10 h-10 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-center justify-center mb-2">
                  <Router className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase">CORE</span>
              </div>
              
              <div className="flex flex-col items-center bg-surface p-2">
                <div className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center mb-2">
                  <Laptop className="w-5 h-5 text-text-muted" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase">LAN ({data.status?.network?.totalDevices ?? 0})</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-surface border border-border rounded-xl p-6 border-l-2 border-l-danger">
            <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">Recent Alerts</h2>
            <div className="space-y-4">
              {data.alerts.slice(0,3).map((alert: any) => (
                <div key={alert.id} className="flex gap-3">
                  <div className="mt-0.5">
                    {alert.type === 'new_device' ? (
                      <Activity className="w-4 h-4 text-primary" />
                    ) : (
                      <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-danger' : 'text-orange-400'}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-text leading-snug">{alert.message}</p>
                    <p className="text-xs text-text-muted mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {data.alerts.length === 0 && (
                <p className="text-sm text-text-muted">No unresolved alerts.</p>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}
