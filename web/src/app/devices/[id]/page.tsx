'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit2, Check, Laptop, Router } from 'lucide-react';
import Link from 'next/link';

export default function DeviceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [device, setDevice] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    // For now, fetch all devices and find the one. Phase 8 can add a specific endpoint if needed.
    fetch(`${backendUrl}/api/devices`)
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
  }, [id]);

  const saveName = () => {
    // In Phase 8 this will PUT to the backend. For now just update local state.
    setDevice({ ...device, name: editName });
    setIsEditing(false);
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
      
      {/* Usage chart placeholder */}
      <div className="bg-surface border border-border rounded-xl p-6 h-64 flex flex-col justify-center items-center text-text-muted">
         <p>Detailed per-device bandwidth usage chart will be implemented in Phase 5.</p>
      </div>

    </div>
  );
}
