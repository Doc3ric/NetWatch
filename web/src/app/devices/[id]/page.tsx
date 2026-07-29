'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit2, Check, Laptop, Router, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function DeviceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [device, setDevice] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [toast, setToast] = useState<{ message: string, visible: boolean } | null>(null);
  const [uptime, setUptime] = useState<{ uptimePct: number | null, hasHistory: boolean } | null>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message, visible: false }), 3000);
  };

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    fetch(`${backendUrl}/api/devices`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const found = data.find((d: any) => d.id === id);
        if (found) {
          setDevice(found);
          setEditName(found.name || found.vendor);
        }
      })
      .catch(console.error);

    // Fetch uptime data for this device
    fetch(`${backendUrl}/api/devices/${id}/uptime?days=30`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUptime({ uptimePct: d.uptimePct, hasHistory: d.hasHistory }))
      .catch(() => {});
  }, [id]);

  const saveName = async () => {
    if (!editName.trim()) {
      setIsEditing(false);
      return;
    }
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName })
      });
      
      if (!res.ok) throw new Error('Failed to save device name');
      
      setDevice({ ...device, name: editName });
      setIsEditing(false);
      showToast('Device renamed');
    } catch (err) {
      console.error(err);
      showToast('Failed to rename device');
    }
  };

  if (!device) return <div className="p-12 text-center text-text-muted animate-pulse">Loading device details...</div>;

  return (
    <div className="space-y-6">
      <Link href="/devices" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Devices
      </Link>

      <div className="bg-surface border border-border rounded-xl p-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-background border border-border flex items-center justify-center shrink-0">
            {device.type === 'router' ? <Router className="w-10 h-10 text-text-muted" /> : <Laptop className="w-10 h-10 text-text-muted" />}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="bg-background border border-primary rounded px-3 py-1 text-2xl font-bold focus:outline-none"
                  />
                  <button onClick={saveName} className="p-1.5 bg-primary/20 text-primary rounded hover:bg-primary/30"><Check className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-text">{device.name || device.vendor}</h1>
                  <button onClick={() => setIsEditing(true)} className="p-1.5 text-text-muted hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            
            <p className="text-text-muted text-lg">{device.vendor}</p>
            
            <div className="flex items-center gap-6 mt-6">
              <div>
                <p className="text-sm text-text-muted mb-1">IP Address</p>
                <p className="font-mono">{device.ip}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">MAC Address</p>
                <p className="font-mono">{device.mac}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-primary' : 'bg-text-muted'}`}></span>
                  <span className={device.status === 'online' ? 'text-primary' : 'text-text-muted'}>
                    {device.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 bg-surface border border-border text-text px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-opacity duration-300 ${toast.visible ? 'opacity-100' : 'opacity-0'}`}>
          <Check className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">First Seen</h2>
          <p className="text-lg">{new Date(device.firstSeen).toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-4">Last Seen</h2>
          <p className="text-lg">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}</p>
        </div>
      </div>
      
      {/* Uptime Section */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase mb-5">Uptime (Last 30 Days)</h2>
        {!uptime?.hasHistory ? (
          <div className="flex flex-col items-center justify-center py-6 text-text-muted gap-2">
            <div className="w-16 h-16 rounded-full border-4 border-border flex items-center justify-center">
              <span className="text-xl font-bold text-text-muted">—</span>
            </div>
            <p className="text-sm">Accumulating data...</p>
            <p className="text-xs text-text-muted/60">Uptime tracking began when this version was deployed.</p>
          </div>
        ) : (() => {
          const pct = uptime?.uptimePct ?? 0;
          const color = pct >= 90 ? '#34d399' : pct >= 70 ? '#fbbf24' : '#f87171';
          const circumference = 2 * Math.PI * 36;
          const dashOffset = circumference * (1 - pct / 100);
          return (
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Circular gauge */}
              <div className="relative shrink-0">
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
                  <circle
                    cx="48" cy="48" r="36" fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              {/* Stats */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  {device.status === 'online'
                    ? <Wifi className="w-4 h-4 text-emerald-400" />
                    : <WifiOff className="w-4 h-4 text-orange-400" />}
                  <span className="text-sm">
                    Currently <span className={device.status === 'online' ? 'text-emerald-400 font-medium' : 'text-orange-400 font-medium'}>{device.status}</span>
                  </span>
                </div>
                <div className="text-sm text-text-muted">
                  Last seen {device.lastSeen ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true }) : 'never'}
                </div>
                <div className="text-xs text-text-muted/60">30-day window · transitions tracked since deploy</div>
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
