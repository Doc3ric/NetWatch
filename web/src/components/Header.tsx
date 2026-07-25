'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Wifi, Circle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter, useSearchParams } from 'next/navigation';

export function Header() {
  const { isConnected } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync URL param if it changes externally
    setSearch(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (val) {
      router.replace(`/?q=${encodeURIComponent(val)}`);
    } else {
      router.replace('/');
    }
  };

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/alerts?resolved=false`);
        const data = await res.json();
        setAlerts(data);
      } catch (err) {
        console.error('Failed to fetch alerts for header', err);
      }
    };
    fetchAlerts();
    
    // Poll every 10s for new alerts
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            value={search}
            onChange={handleSearch}
            placeholder="Search network..." 
            className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors text-text placeholder-text-muted"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6 ml-6">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Wifi className="w-4 h-4" />
          <span>Home-Office-5G</span>
          <div className="flex items-center gap-1.5 ml-2 bg-background px-2.5 py-1 rounded-full border border-border">
            <Circle className={`w-2 h-2 fill-current ${isConnected ? 'text-primary' : 'text-danger'}`} />
            <span className={isConnected ? 'text-primary font-medium' : 'text-danger font-medium'}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-6 relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative transition-colors ${showNotifications ? 'text-primary' : 'text-text-muted hover:text-text'}`}
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-surface"></span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute top-12 right-0 w-80 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-hover/30 flex justify-between items-center">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <span className="text-xs text-primary font-medium">{alerts.length} new</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-text-muted text-sm">
                    No new notifications
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {alerts.map(alert => (
                      <div key={alert.id} className="p-4 hover:bg-surface-hover/50 transition-colors flex gap-3 items-start">
                        <div className="mt-0.5 shrink-0">
                          {alert.type === 'new_device' || alert.severity === 'info' ? (
                            <Info className="w-4 h-4 text-blue-400" />
                          ) : alert.severity === 'critical' ? (
                            <AlertOctagon className="w-4 h-4 text-danger" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-text leading-snug">{alert.message}</p>
                          <p className="text-xs text-text-muted mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 ml-2">
            <UserAvatar />
          </div>
        </div>
      </div>
    </header>
  );
}

function UserAvatar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-primary">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}
