'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Activity, Globe2, Router, Laptop, MoreVertical, ArrowUpRight, ArrowDownRight, AlertTriangle, Loader2, ShieldCheck, SearchX, CheckCircle2, Info, AlertOctagon, Edit2, Check, X, Smartphone, Tv, Cpu, HelpCircle } from 'lucide-react';
import { AreaChart, Area, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useSearchParams } from 'next/navigation';

const getDeviceIcon = (type: string, className: string) => {
  switch (type?.toLowerCase()) {
    case 'router': return <Router className={className} />;
    case 'laptop': case 'desktop': return <Laptop className={className} />;
    case 'phone': return <Smartphone className={className} />;
    case 'tv': return <Tv className={className} />;
    case 'iot': return <Cpu className={className} />;
    default: return <HelpCircle className={className} />;
  }
};

const FlashingValue = ({ value, children }: { value: any, children: React.ReactNode }) => {
  const [flash, setFlash] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 200);
    return () => clearTimeout(t);
  }, [value]);

  return <span className={`transition-all duration-200 ${flash ? 'text-primary bg-primary/20 rounded px-1 -mx-1' : ''}`}>{children}</span>;
};

export default function Dashboard() {
  const { socket, isConnected } = useSocket();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const [data, setData] = useState<any>({
    status: null,
    metrics: [],
    devices: [],
    alerts: []
  });
  const [timeRange, setTimeRange] = useState('1h');
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [toast, setToast] = useState<{ message: string, visible: boolean } | null>(null);
  
  // Inline editing state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message, visible: false }), 3000);
  };

  const handleResolveAlert = async (id: string) => {
    if (!window.confirm('Mark this alert as resolved?')) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolved: true })
      });
      setData((prev: any) => ({ ...prev, alerts: prev.alerts.filter((a: any) => a.id !== id) }));
      showToast('Alert resolved');
    } catch (err) {
      console.error('Failed to resolve alert', err);
    }
  };

  const startEditing = (device: any) => {
    setEditingDeviceId(device.id);
    setEditingDeviceName(device.name || device.vendor || '');
  };

  const saveEditing = async (id: string) => {
    if (!editingDeviceName.trim()) {
      setEditingDeviceId(null);
      return;
    }
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editingDeviceName })
      });
      setData((prev: any) => ({
        ...prev,
        devices: prev.devices.map((d: any) => d.id === id ? { ...d, name: editingDeviceName } : d)
      }));
      setEditingDeviceId(null);
      showToast('Device renamed');
    } catch (err) {
      console.error('Failed to rename device', err);
    }
  };

  const cancelEditing = () => {
    setEditingDeviceId(null);
    setEditingDeviceName('');
  };

  // Time Ago Updater
  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
      if (diff < 5) setTimeAgo('just now');
      else if (diff < 60) setTimeAgo(`${diff}s ago`);
      else setTimeAgo(`${Math.floor(diff/60)}m ago`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Initial Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        
        // Fetch status first to check auth before doing parallel requests
        const statusCheck = await fetch(`${backendUrl}/api/status`, { credentials: 'include' });
        if (statusCheck.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        const statusRes = await statusCheck.json();
        
        const [metricsRes, devicesRes, alertsRes] = await Promise.all([
          fetch(`${backendUrl}/api/metrics?range=${timeRange}`, { credentials: 'include' }).then(res => res.json()),
          fetch(`${backendUrl}/api/devices`, { credentials: 'include' }).then(res => res.json()),
          fetch(`${backendUrl}/api/alerts?resolved=false`, { credentials: 'include' }).then(res => res.json())
        ]);
        
        setData({
          status: statusRes,
          metrics: Array.isArray(metricsRes) ? metricsRes.reverse() : [], // Ensure oldest first for recharts
          devices: Array.isArray(devicesRes) ? devicesRes : [],
          alerts: Array.isArray(alertsRes) ? alertsRes : []
        });
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setIsLoading(false);
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
      setLastUpdated(new Date());
    };

    socket.on('network:update', handleUpdate);
    return () => {
      socket.off('network:update', handleUpdate);
    };
  }, [socket]);

  const latestMetric = data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Top Cards Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 h-[200px]">
            <div className="h-4 bg-border rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-2 gap-y-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="h-3 bg-border rounded w-1/2 mb-2"></div>
                  <div className="h-5 bg-border rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6 h-[200px]">
            <div className="h-4 bg-border rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-4 gap-4 h-full">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex flex-col">
                  <div className="h-4 w-4 bg-border rounded mb-2"></div>
                  <div className="h-3 bg-border rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-border rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 h-[300px]">
             <div className="flex justify-between mb-6">
               <div className="h-4 bg-border rounded w-1/4"></div>
               <div className="h-6 bg-border rounded w-32"></div>
             </div>
             <div className="h-48 bg-border/50 rounded w-full"></div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6 h-[300px]">
             <div className="flex justify-between mb-6">
               <div className="h-4 bg-border rounded w-1/4"></div>
               <div className="h-4 bg-border rounded w-16"></div>
             </div>
             <div className="h-48 bg-border/50 rounded w-full"></div>
          </div>
        </div>

        {/* Bottom Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
            <div className="flex justify-between mb-6">
              <div className="h-4 bg-border rounded w-1/4"></div>
              <div className="h-4 bg-border rounded w-16"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between py-2 border-b border-border/50">
                  <div className="h-4 bg-border rounded w-1/4"></div>
                  <div className="h-4 bg-border rounded w-1/4"></div>
                  <div className="h-4 bg-border rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
             <div className="bg-surface border border-border rounded-xl p-6 h-[180px]">
               <div className="h-4 bg-border rounded w-1/3 mb-6"></div>
               <div className="flex justify-between px-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-10 h-10 bg-border rounded-lg"></div>
                  ))}
               </div>
             </div>
             <div className="bg-surface border border-border rounded-xl p-6 h-[200px]">
               <div className="h-4 bg-border rounded w-1/3 mb-4"></div>
               <div className="space-y-4">
                 {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="w-4 h-4 bg-border rounded"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-border rounded w-3/4 mb-1"></div>
                        <div className="h-2 bg-border rounded w-1/4"></div>
                      </div>
                    </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* System Status Card */}
        <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">System Status</h2>
              {isConnected && (
                <div className="flex items-center gap-2 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-[10px] font-medium text-primary tracking-wide">LIVE</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs font-mono text-text-muted">Updated {timeAgo}</span>
              )}
              <button className="text-text-muted hover:text-text"><MoreVertical className="w-5 h-5" /></button>
            </div>
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
                await fetch(`${backendUrl}/api/speedtest/trigger`, { method: 'POST', credentials: 'include' });
              }}
              disabled={isTesting}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-colors ${isTesting ? 'bg-surface-hover text-text-muted cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            >
              {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isTesting ? 'Running...' : 'Run Speed Test'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
            <div className="flex flex-col">
              <div className="text-text-muted mb-2"><Activity className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Ping</p>
              <p className="text-xl font-semibold"><FlashingValue value={latestMetric?.pingMs}>{latestMetric?.pingMs ? Math.round(latestMetric.pingMs) : '--'}</FlashingValue>ms</p>
            </div>
            <div className="flex flex-col">
              <div className="text-primary mb-2"><ArrowDownRight className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Download</p>
              <p className="text-xl font-semibold text-primary"><FlashingValue value={latestMetric?.downloadMbps}>{latestMetric?.downloadMbps ? latestMetric.downloadMbps.toFixed(1) : '--'}</FlashingValue> Mbps</p>
            </div>
            <div className="flex flex-col">
              <div className="text-primary mb-2"><ArrowUpRight className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Upload</p>
              <p className="text-xl font-semibold text-primary"><FlashingValue value={latestMetric?.uploadMbps}>{latestMetric?.uploadMbps ? latestMetric.uploadMbps.toFixed(1) : '--'}</FlashingValue> Mbps</p>
            </div>
            <div className="flex flex-col">
              <div className="text-danger mb-2"><AlertTriangle className="w-4 h-4" /></div>
              <p className="text-sm text-text-muted mb-1">Packet Loss</p>
              <p className="text-xl font-semibold"><FlashingValue value={latestMetric?.packetLossPct}>{latestMetric?.packetLossPct ? Math.round(latestMetric.packetLossPct) : '0'}</FlashingValue>%</p>
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
                  className={`px-3 py-1 rounded transition-colors ${timeRange === range ? 'bg-primary/20 text-primary shadow-sm border border-primary/30' : 'text-text-muted hover:text-text'}`}
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
                <ReferenceLine y={150} stroke="#FF5A5F" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151A22', borderColor: '#2A3441', color: '#E2E8F0' }}
                  itemStyle={{ color: '#E2E8F0' }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(value: any) => [`${Math.round(value)} ms`, 'Ping']}
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
            {data.metrics.filter((m: any) => m.downloadMbps !== null).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm">No data yet — click Run Speed Test</span>
              </div>
            ) : (
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
            )}
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
                {data.devices
                  .filter((d: any) => !searchQuery || 
                    (d.name && d.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (d.vendor && d.vendor.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (d.ip && d.ip.includes(searchQuery)) ||
                    (d.mac && d.mac.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .slice(0,5).map((device: any) => (
                  <tr key={device.id} className="hover:bg-surface-hover/80 transition-colors group">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3 text-text">
                        {getDeviceIcon(device.type, "w-4 h-4 text-text-muted shrink-0")}
                        {editingDeviceId === device.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              autoFocus
                              type="text" 
                              value={editingDeviceName}
                              onChange={(e) => setEditingDeviceName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing(device.id);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              className="bg-background border border-primary/50 text-xs rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-primary text-text"
                            />
                            <button onClick={() => saveEditing(device.id)} className="text-primary hover:text-primary/80"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={cancelEditing} className="text-text-muted hover:text-danger"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 max-w-[150px]">
                            <span className="truncate">{device.name || device.vendor || device.ip}</span>
                            <button 
                              onClick={() => startEditing(device)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-primary shrink-0"
                              title="Rename device"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 font-mono">{device.ip}</td>
                    <td className="px-2 py-3 font-mono text-xs">{device.mac}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${device.status === 'online' ? 'bg-primary' : 'bg-text-muted'}`}></span>
                        <FlashingValue value={device.status}>
                          <span className={device.status === 'online' ? 'text-text' : 'text-text-muted'}>
                            {device.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </FlashingValue>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-primary font-mono text-xs">-- GB</td>
                  </tr>
                ))}
                {data.devices.filter((d: any) => !searchQuery || 
                    (d.name && d.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (d.vendor && d.vendor.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (d.ip && d.ip.includes(searchQuery)) ||
                    (d.mac && d.mac.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-text-muted">
                      <SearchX className="w-8 h-8 mb-2 opacity-50 text-primary mx-auto" />
                      <p className="text-sm">No devices found.</p>
                    </td>
                  </tr>
                )}
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
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-2 ${isConnected ? 'border-primary/30 bg-primary/10' : 'border-danger/30 bg-danger/10'}`}>
                  <Globe2 className={`w-5 h-5 ${isConnected ? 'text-primary' : 'text-danger'}`} />
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
                <div key={alert.id} className="flex gap-3 group items-start">
                  <div className="mt-0.5 shrink-0">
                    {alert.type === 'new_device' || alert.severity === 'info' ? (
                      <Info className="w-4 h-4 text-blue-400" />
                    ) : alert.severity === 'critical' ? (
                      <AlertOctagon className="w-4 h-4 text-danger" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-text leading-snug">{alert.message}</p>
                    <p className="text-xs text-text-muted mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <button 
                    onClick={() => handleResolveAlert(alert.id)}
                    title="Mark Resolved"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-primary shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {data.alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-4 text-text-muted">
                  <ShieldCheck className="w-8 h-8 mb-2 opacity-50 text-primary" />
                  <p className="text-sm">No active alerts.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 bg-surface border border-border text-text px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-opacity duration-300 ${toast.visible ? 'opacity-100' : 'opacity-0'}`}>
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
