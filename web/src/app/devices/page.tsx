'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Laptop, Router, Search, Filter, Smartphone, Tv, Cpu, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const getDeviceIcon = (type: string, className: string) => {
  switch (type?.toLowerCase()) {
    case 'router': return <Router className={className} />;
    case 'laptop': case 'desktop': return <Laptop className={className} />;
    case 'phone': return <Smartphone className={className} />;
    case 'tv': return <Tv className={className} />;
    case 'iot': return <Cpu className={className} />;
    default: return <Circle className={className} />;
  }
};

export default function DevicesPage() {
  const { socket } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<any[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');

  // Sync search from URL
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (val) {
      router.replace(`/devices?q=${encodeURIComponent(val)}`);
    } else {
      router.replace('/devices');
    }
  };

  // Initial Fetch
  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    fetch(`${backendUrl}/api/devices`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setDevices(data))
      .catch(console.error);
  }, []);

  // Socket Live Updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (update: any) => {
      setDevices(update.devices);
    };
    socket.on('network:update', handleUpdate);
    return () => {
      socket.off('network:update', handleUpdate);
    };
  }, [socket]);

  const filtered = (devices || []).filter(d => 
    (d.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (d.vendor?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (d.ip || '').includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold">Connected Devices</h1>
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full md:w-64 bg-surface border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary text-text"
            />
          </div>
          <button className="bg-surface border border-border p-2 rounded-md hover:text-primary transition-colors shrink-0">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase tracking-wider border-b border-border text-text-muted bg-surface-hover/30">
            <tr>
              <th className="px-6 py-4 font-medium">Device Name</th>
              <th className="px-6 py-4 font-medium">IP & MAC</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Last Seen</th>
              <th className="px-6 py-4 font-medium text-right">Ping</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map(device => (
              <tr key={device.id} className="hover:bg-surface-hover/50 transition-colors group">
                <td className="px-6 py-4">
                  <Link href={`/devices/${device.id}`} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                      {getDeviceIcon(device.type, "w-5 h-5 text-text-muted group-hover:text-primary transition-colors")}
                    </div>
                    <div>
                      <p className="font-semibold text-text group-hover:text-primary transition-colors">{device.name || device.vendor}</p>
                      <p className="text-xs text-text-muted">{device.vendor}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <p className="font-mono text-sm">{device.ip}</p>
                  <p className="font-mono text-xs text-text-muted">{device.mac}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-primary' : 'bg-text-muted'}`}></span>
                    <span className={device.status === 'online' ? 'text-primary font-medium' : 'text-text-muted'}>
                      {device.status === 'online' ? 'Active' : 'Offline'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-text-muted">
                  {device.lastSeen ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true }) : 'Never'}
                </td>
                <td className="px-6 py-4 text-right">
                  {device.lastPingMs !== null && device.lastPingMs !== undefined ? `${Math.round(device.lastPingMs)} ms` : '--'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                  No devices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
