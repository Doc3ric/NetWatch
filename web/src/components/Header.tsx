'use client';

import { Search, Bell, Wifi, Circle } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';

export function Header() {
  const { isConnected } = useSocket();

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
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

        <div className="flex items-center gap-4 border-l border-border pl-6">
          <button className="relative text-text-muted hover:text-text transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full border border-surface"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
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
