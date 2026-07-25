'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { formatDistanceToNow, format } from 'date-fns';
import { Gauge, ArrowDownRight, ArrowUpRight, Activity, Loader2, Play } from 'lucide-react';

export default function SpeedTestPage() {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/metrics?hours=168`, { credentials: 'include' }); // 7 days
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        console.error('Expected array of metrics, got:', data);
        setMetrics([]);
        return;
      }

      // Filter only metrics that have speed test data
      const speedTests = data.filter((m: any) => m.downloadMbps !== null && m.uploadMbps !== null);
      
      // Sort newest first
      speedTests.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setMetrics(speedTests);
    } catch (err) {
      console.error('Error fetching speed test data:', err);
      setMetrics([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    
    const handleUpdate = (update: any) => {
      if (update.type === 'speedtest_result') {
        setIsTesting(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedSeconds(0);
        setErrorMsg(null);
        
        // Add new result to the top of the list, ensuring we have a timestamp
        setMetrics(prev => {
          const newMetric = {
            ...update.metrics,
            timestamp: update.timestamp || new Date().toISOString(),
            wanPingMs: update.metrics.wanPingMs || 0
          };
          const newMetrics = [newMetric, ...prev];
          return newMetrics;
        });
      }
    };

    const handleError = (error: any) => {
      if (error.type === 'speedtest_error') {
        setIsTesting(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedSeconds(0);
        setErrorMsg(`Speed test failed — ${error.message}`);
      }
    };

    socket.on('network:update', handleUpdate);
    socket.on('network:error', handleError);
    return () => {
      socket.off('network:update', handleUpdate);
      socket.off('network:error', handleError);
    };
  }, [socket]);

  const triggerTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setElapsedSeconds(0);
    setErrorMsg(null);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        if (next > 60) {
          clearInterval(timerRef.current!);
          setIsTesting(false);
          setErrorMsg('Speed test timed out — try again');
          return 0;
        }
        return next;
      });
    }, 1000);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/speedtest/trigger`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Failed to trigger speedtest:', err);
      setIsTesting(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setErrorMsg('Failed to trigger speed test');
    }
  };

  const latest = metrics.length > 0 ? metrics[0] : null;

  // Calculate 7-day stats
  const avgDownload = metrics.length > 0 ? metrics.reduce((acc, curr) => acc + curr.downloadMbps, 0) / metrics.length : 0;
  const avgUpload = metrics.length > 0 ? metrics.reduce((acc, curr) => acc + curr.uploadMbps, 0) / metrics.length : 0;
  const bestDownload = metrics.length > 0 ? Math.max(...metrics.map(m => m.downloadMbps)) : 0;
  const worstDownload = metrics.length > 0 ? Math.min(...metrics.map(m => m.downloadMbps)) : 0;

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-[400px] bg-surface border border-border rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">Speed Test</h1>
      </div>

      {/* Hero Section */}
      <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-4 right-6 text-sm text-text-muted text-right">
            {latest ? (
              <>
                Last tested {formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })}
                <p className="text-xs mt-1">ISP: Quantum Fiber</p>
              </>
            ) : (
              'No previous tests'
            )}
        </div>

        <div className="flex flex-col md:flex-row gap-16 items-center w-full max-w-4xl justify-center my-8">
          <CircularGauge label="PING" value={latest?.wanPingMs || 0} unit="ms" color="#94A3B8" max={100} icon={<Activity className="w-5 h-5" />} />
          <div className="flex flex-col items-center z-10 shrink-0">
             <button
                onClick={triggerTest}
                disabled={isTesting}
                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 shadow-xl transition-all ${
                  isTesting 
                    ? 'bg-surface border-primary/30 cursor-not-allowed' 
                    : 'bg-primary border-primary/20 hover:scale-105 hover:shadow-primary/20 cursor-pointer text-background'
                }`}
             >
                {isTesting ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                    <span className="text-primary font-medium text-lg">Testing...</span>
                    <span className="text-primary/70 text-sm">{elapsedSeconds}s elapsed</span>
                  </>
                ) : (
                  <>
                    <Play className="w-10 h-10 mb-2 fill-current" />
                    <span className="font-bold text-lg">GO</span>
                  </>
                )}
              </button>
             {errorMsg && (
                <div className="absolute top-full mt-2 w-[300px] text-red-400 font-medium text-sm text-center bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {errorMsg}
                </div>
             )}
          </div>
          <CircularGauge label="DOWNLOAD" value={latest?.downloadMbps || 0} unit="Mbps" color="#3B82F6" max={1000} icon={<ArrowDownRight className="w-5 h-5" />} />
          <CircularGauge label="UPLOAD" value={latest?.uploadMbps || 0} unit="Mbps" color="#10B981" max={1000} icon={<ArrowUpRight className="w-5 h-5" />} />
        </div>
      </div>

      {/* Stats Row */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">7-Day Averages</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-muted">Download</span>
              <span className="font-semibold text-lg text-primary">{avgDownload.toFixed(1)} <span className="text-xs text-text-muted font-normal">Mbps</span></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Upload</span>
              <span className="font-semibold text-lg text-emerald-500">{avgUpload.toFixed(1)} <span className="text-xs text-text-muted font-normal">Mbps</span></span>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">Best Performance</h3>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Peak Download</span>
              <span className="font-semibold text-lg text-primary">{bestDownload.toFixed(1)} <span className="text-xs text-text-muted font-normal">Mbps</span></span>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">Lowest Performance</h3>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Slowest Download</span>
              <span className="font-semibold text-lg text-danger">{worstDownload.toFixed(1)} <span className="text-xs text-text-muted font-normal">Mbps</span></span>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-surface-hover/30">
          <h2 className="font-semibold text-lg">Speed Test History</h2>
        </div>
        
        {metrics.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
             <Gauge className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p className="text-lg mb-2">No speed tests yet.</p>
             <p className="text-sm">Click the GO button above to run your first test.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wider text-text-muted border-b border-border bg-surface/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium text-right">Ping</th>
                    <th className="px-6 py-4 font-medium text-right">Download</th>
                    <th className="px-6 py-4 font-medium text-right">Upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {metrics.slice(0, limit).map((m, i) => (
                    <tr key={i} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-6 py-4 font-medium">{format(new Date(m.timestamp), 'MMM d, yyyy • HH:mm:ss')}</td>
                      <td className="px-6 py-4 text-right">{Math.round(m.wanPingMs)} ms</td>
                      <td className="px-6 py-4 text-right text-primary font-medium">{m.downloadMbps.toFixed(1)} Mbps</td>
                      <td className="px-6 py-4 text-right text-emerald-500 font-medium">{m.uploadMbps.toFixed(1)} Mbps</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {limit < metrics.length && (
              <div className="p-4 border-t border-border text-center bg-surface-hover/30">
                <button 
                  onClick={() => setLimit(prev => prev + 10)}
                  className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors border border-border bg-background rounded-lg shadow-sm"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper SVG Gauge component
function CircularGauge({ value, label, unit, color, max, icon }: { value: number, label: string, unit: string, color: string, max: number, icon: React.ReactNode }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center w-36 h-36">
        {/* Background Track */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle cx="72" cy="72" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-border" />
          <circle cx="72" cy="72" r={radius} stroke={color} strokeWidth="8" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out drop-shadow-md"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex flex-col items-center justify-center z-10" style={{ color }}>
          <div className="mb-1 opacity-80">{icon}</div>
          <span className="text-2xl font-bold">{value > 0 ? (value < 10 ? value.toFixed(1) : Math.round(value)) : '--'}</span>
          <span className="text-[10px] font-medium tracking-wide uppercase opacity-80">{unit}</span>
        </div>
      </div>
      <span className="mt-4 text-sm font-bold tracking-widest text-text-muted uppercase">{label}</span>
    </div>
  );
}
