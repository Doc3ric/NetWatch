'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Activity, List, WifiOff, Wifi, Zap, Edit3,
  Thermometer, AlertTriangle, Gauge, Radio
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

type ActivityEvent = {
  id: string;
  type: 'device_online' | 'device_offline' | 'new_device' | 'device_renamed' | 'speedtest_result';
  timestamp: string;
  deviceId?: string;
  deviceIp?: string;
  deviceName?: string;
  message: string;
  meta?: Record<string, any>;
};

type HeatmapDevice = {
  id: string;
  name: string;
  ip: string;
  hours: number[]; // 24-element, 0.0–1.0
  hasHistory: boolean;
};

type AlertRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  resolved: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  device_online:   'border-emerald-500/60 bg-emerald-500/8',
  new_device:      'border-primary/60 bg-primary/8',
  device_offline:  'border-orange-500/60 bg-orange-500/8',
  device_renamed:  'border-amber-400/60 bg-amber-400/8',
  speedtest_result:'border-violet-500/60 bg-violet-500/8',
};

const EVENT_DOT: Record<string, string> = {
  device_online:   'bg-emerald-400',
  new_device:      'bg-primary',
  device_offline:  'bg-orange-400',
  device_renamed:  'bg-amber-400',
  speedtest_result:'bg-violet-400',
};

function EventIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4';
  if (type === 'device_online')    return <Wifi className={`${cls} text-emerald-400`} />;
  if (type === 'new_device')       return <Activity className={`${cls} text-primary`} />;
  if (type === 'device_offline')   return <WifiOff className={`${cls} text-orange-400`} />;
  if (type === 'device_renamed')   return <Edit3 className={`${cls} text-amber-400`} />;
  if (type === 'speedtest_result') return <Gauge className={`${cls} text-violet-400`} />;
  return <AlertTriangle className={`${cls} text-text-muted`} />;
}

function heatColor(fraction: number): string {
  if (fraction <= 0) return 'bg-surface border-border/40';
  if (fraction < 0.15) return 'bg-primary/10 border-primary/20';
  if (fraction < 0.35) return 'bg-primary/25 border-primary/35';
  if (fraction < 0.55) return 'bg-primary/45 border-primary/55';
  if (fraction < 0.75) return 'bg-primary/65 border-primary/70';
  return 'bg-primary/90 border-primary';
}

const HOUR_LABELS = ['12a','1','2','3','4','5','6','7','8','9','10','11','12p','1','2','3','4','5','6','7','8','9','10','11'];

// ─── Tab: Live Feed ───────────────────────────────────────────────────────────

function LiveFeedTab() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

    // Seed from historical API
    fetch(`${backendUrl}/api/activity?days=7`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: ActivityEvent[]) => {
        setEvents(data.slice(0, 200));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Real-time socket
    const socket: Socket = io(backendUrl, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('activity:event', (ev: ActivityEvent) => {
      setEvents(prev => [ev, ...prev].slice(0, 200));
    });

    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">Real-time device join/leave events, renames, and speed tests.</p>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-border text-text-muted'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
          {connected ? 'LIVE' : 'Disconnected'}
        </span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted">
            <Activity className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
            <p>Loading activity...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-30 text-primary" />
            <p className="text-lg font-medium">Waiting for events</p>
            <p className="text-sm mt-1">Device events will appear here in real time.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map(ev => (
              <div key={ev.id} className={`flex items-start gap-4 px-5 py-3.5 border-l-2 transition-colors hover:bg-surface-hover/20 ${EVENT_COLORS[ev.type] || 'border-border bg-surface'}`}>
                <div className="mt-0.5 shrink-0">
                  <EventIcon type={ev.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text leading-snug">{ev.message}</p>
                  {ev.type === 'speedtest_result' && ev.meta && (
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-emerald-400">↓ {ev.meta.downloadMbps?.toFixed(1)} Mbps</span>
                      <span className="text-xs text-primary">↑ {ev.meta.uploadMbps?.toFixed(1)} Mbps</span>
                      <span className="text-xs text-text-muted">ping {Math.round(ev.meta.pingMs || 0)} ms</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-text-muted shrink-0 mt-0.5 tabular-nums">
                  {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Heat Map ────────────────────────────────────────────────────────────

function HeatMapTab() {
  const [data, setData] = useState<{ devices: HeatmapDevice[], aggregate: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [tooltip, setTooltip] = useState<{ text: string, x: number, y: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    fetch(`${backendUrl}/api/heatmap?days=${days}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const hasAnyHistory = data?.devices.some(d => d.hasHistory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">Average device presence per hour of day — darker = more often online.</p>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-surface border border-border text-text text-sm rounded-lg p-2 focus:ring-primary focus:border-primary"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={60}>Last 60 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
          <Thermometer className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
          <p>Loading heat map...</p>
        </div>
      ) : !hasAnyHistory ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
          <Thermometer className="w-12 h-12 mx-auto mb-4 opacity-30 text-primary" />
          <p className="text-lg font-medium">Accumulating data</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">History is collected as devices come and go. Check back after a few hours for your first heat map.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden relative">
          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 bg-background border border-border text-text text-xs px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
            >
              {tooltip.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-text-muted font-medium w-36">Device</th>
                  {HOUR_LABELS.map((label, h) => (
                    <th key={h} className="text-center text-[10px] text-text-muted font-normal py-3 px-0.5 w-8">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {/* Aggregate row */}
                {data!.aggregate && (
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 text-xs font-semibold text-primary">All Devices</td>
                    {data!.aggregate.map((agg, h) => (
                      <td key={h} className="px-0.5 py-2">
                        <div
                          className={`w-6 h-6 mx-auto rounded border cursor-default transition-all ${heatColor(agg.presenceFraction)}`}
                          onMouseMove={e => setTooltip({ text: `${Math.round(agg.presenceFraction * 100)}% of devices online at ${HOUR_LABELS[h]}`, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      </td>
                    ))}
                  </tr>
                )}
                {/* Per-device rows */}
                {data!.devices.filter(d => d.hasHistory).map(dev => (
                  <tr key={dev.id} className="hover:bg-surface-hover/20 transition-colors">
                    <td className="px-4 py-2">
                      <p className="text-xs font-medium text-text truncate max-w-[120px]">{dev.name}</p>
                      <p className="text-[10px] text-text-muted font-mono">{dev.ip}</p>
                    </td>
                    {dev.hours.map((fraction, h) => (
                      <td key={h} className="px-0.5 py-2">
                        <div
                          className={`w-6 h-6 mx-auto rounded border cursor-default transition-all ${heatColor(fraction)}`}
                          onMouseMove={e => setTooltip({ text: `${dev.name} — ${Math.round(fraction * 100)}% online at ${HOUR_LABELS[h]}:00`, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-border flex items-center gap-3">
            <span className="text-xs text-text-muted">Less</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(f => (
              <div key={f} className={`w-4 h-4 rounded border ${heatColor(f)}`} />
            ))}
            <span className="text-xs text-text-muted">More</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: History (existing alert log, preserved as-is) ───────────────────────

function HistoryTab() {
  const [activities, setActivities] = useState<AlertRow[]>([]);
  const [daysFilter, setDaysFilter] = useState<'1' | '7' | '30'>('30');
  const [typeFilter, setTypeFilter] = useState<'all' | 'device' | 'performance'>('all');
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setLimit(50);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    let url = `${backendUrl}/api/alerts?days=${daysFilter}`;
    if (typeFilter !== 'all') url += `&type=${typeFilter}`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setActivities(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [daysFilter, typeFilter]);

  const displayed = activities.slice(0, limit);

  const getIcon = (type: string, severity: string) => {
    if (type === 'new_device') return <Activity className="w-5 h-5 text-primary" />;
    if (type === 'device_offline') return <WifiOff className="w-5 h-5 text-orange-500" />;
    if (type === 'high_latency' || type === 'high_packet_loss')
      return <Zap className={`w-5 h-5 ${severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />;
    return <AlertTriangle className="w-5 h-5 text-text-muted" />;
  };

  const getBg = (type: string, severity: string) => {
    if (type === 'new_device') return 'bg-primary/10 border-primary/20';
    if (type === 'device_offline') return 'bg-orange-500/10 border-orange-500/20';
    if (type === 'high_latency' || type === 'high_packet_loss')
      return severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20';
    return 'bg-surface-hover border-border';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-end">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-surface border border-border text-text text-sm rounded-lg p-2 focus:ring-primary focus:border-primary">
          <option value="all">All Events</option>
          <option value="device">Device Events</option>
          <option value="performance">Performance Events</option>
        </select>
        <select value={daysFilter} onChange={e => setDaysFilter(e.target.value as any)}
          className="bg-surface border border-border text-text text-sm rounded-lg p-2 focus:ring-primary focus:border-primary">
          <option value="1">Today</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
          </div>
        )}
        <div className="divide-y divide-border">
          {displayed.map(a => (
            <div key={a.id} className="p-4 sm:p-5 flex gap-4 hover:bg-surface-hover/30 transition-colors">
              <div className="mt-1 shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${getBg(a.type, a.severity)}`}>
                  {getIcon(a.type, a.severity)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <h3 className="font-semibold text-lg truncate">
                    {a.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                  <span className="text-sm text-text-muted shrink-0">
                    {format(new Date(a.timestamp), 'MMM d, HH:mm')}
                  </span>
                </div>
                <p className="text-text-muted mt-1 leading-relaxed">{a.message}</p>
              </div>
            </div>
          ))}
          {!isLoading && activities.length === 0 && (
            <div className="p-12 text-center text-text-muted">
              <List className="w-12 h-12 mx-auto mb-4 text-primary opacity-30" />
              <p className="text-lg">No activity found</p>
              <p className="text-sm">Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>
      {activities.length > limit && (
        <div className="flex justify-center pt-2 pb-8">
          <button onClick={() => setLimit(p => p + 50)}
            className="px-6 py-2.5 bg-surface border border-border hover:border-primary/50 text-text rounded-full transition-all hover:shadow-lg text-sm font-medium">
            Load More Activity
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type Tab = 'live' | 'heatmap' | 'history';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'live',    label: 'Live Feed',  icon: <Radio className="w-4 h-4" /> },
  { id: 'heatmap', label: 'Heat Map',   icon: <Thermometer className="w-4 h-4" /> },
  { id: 'history', label: 'History',    icon: <List className="w-4 h-4" /> },
];

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('live');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Activity
        </h1>
        <div className="flex bg-surface border border-border rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-primary text-white shadow' : 'text-text-muted hover:text-text'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'live'    && <LiveFeedTab />}
      {tab === 'heatmap' && <HeatMapTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
