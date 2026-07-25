'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MonitorSmartphone, Activity, Gauge, Bell, FileText, Settings, User } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const mainNav = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Devices', href: '/devices', icon: MonitorSmartphone },
  { name: 'Network Traffic', href: '/traffic', icon: Activity },
  { name: 'Speed Test', href: '/speed', icon: Gauge },
  { name: 'Alerts', href: '/alerts', icon: Bell },
];

const bottomNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 lg:w-64 bg-surface border-r border-border h-full flex flex-col flex-shrink-0 transition-[width] duration-300">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 lg:w-6 lg:h-6 bg-primary rounded flex items-center justify-center shrink-0">
            <span className="text-surface font-bold text-sm lg:text-xs">N</span>
          </div>
          <span className="font-semibold text-lg tracking-tight hidden lg:block">NetWatch</span>
        </div>
      </div>
      <div className="px-6 py-2 hidden lg:block">
        <span className="text-xs font-semibold text-text-muted tracking-wider uppercase">Network Admin</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4">
        {mainNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={twMerge(
                clsx(
                  'flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-surface-hover text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
                )
              )}
              title={item.name}
            >
              <Icon className={clsx("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-text-muted")} />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 mt-auto space-y-1 border-t border-border">
        {bottomNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={twMerge(
                clsx(
                  'flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-surface-hover text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
                )
              )}
              title={item.name}
            >
              <Icon className="w-5 h-5 text-text-muted shrink-0" />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
