'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, CheckCircle2, List, WifiOff, Zap } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [daysFilter, setDaysFilter] = useState<'1' | '7' | '30'>('30');
  const [typeFilter, setTypeFilter] = useState<'all' | 'device' | 'performance'>('all');
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      let url = `${backendUrl}/api/alerts?days=${daysFilter}`;
      if (typeFilter !== 'all') {
        url += `&type=${typeFilter}`;
      }
      
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setActivities(data);
    } catch (err) {
      console.error(err);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    setLimit(50); // reset pagination when filters change
  }, [daysFilter, typeFilter]);

  const getEventIcon = (type: string, severity: string) => {
    if (type === 'new_device') return <Activity className="w-5 h-5 text-primary" />;
    if (type === 'device_offline') return <WifiOff className="w-5 h-5 text-orange-500" />;
    if (type === 'high_latency' || type === 'high_packet_loss') return <Zap className={`w-5 h-5 ${severity === 'critical' ? 'text-danger' : 'text-orange-500'}`} />;
    return <AlertTriangle className="w-5 h-5 text-text-muted" />;
  };

  const getEventBg = (type: string, severity: string) => {
    if (type === 'new_device') return 'bg-primary/10 border-primary/20';
    if (type === 'device_offline') return 'bg-orange-500/10 border-orange-500/20';
    if (type === 'high_latency' || type === 'high_packet_loss') {
      return severity === 'critical' ? 'bg-danger/10 border-danger/20' : 'bg-orange-500/10 border-orange-500/20';
    }
    return 'bg-surface-hover border-border';
  };

  const displayedActivities = activities.slice(0, limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <List className="w-6 h-6 text-primary" />
          Activity Log
        </h1>
        
        <div className="flex flex-wrap gap-3">
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-surface border border-border text-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          >
            <option value="all">All Events</option>
            <option value="device">Device Events</option>
            <option value="performance">Performance Events</option>
          </select>

          <select 
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value as any)}
            className="bg-surface border border-border text-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
          >
            <option value="1">Today</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
          </div>
        )}
        
        <div className="divide-y divide-border">
          {displayedActivities.map(activity => (
            <div key={activity.id} className="p-4 sm:p-5 flex gap-4 hover:bg-surface-hover/30 transition-colors">
              <div className="mt-1 shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${getEventBg(activity.type, activity.severity)}`}>
                  {getEventIcon(activity.type, activity.severity)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <h3 className="font-semibold text-lg truncate">
                    {activity.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </h3>
                  <div className="text-sm text-text-muted shrink-0 flex items-center gap-2">
                    <span className="hidden sm:inline-block text-xs">{format(new Date(activity.timestamp), 'MMM d, HH:mm')}</span>
                    <span className="sm:hidden">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
                  </div>
                </div>
                <p className="text-text-muted mt-1 leading-relaxed">{activity.message}</p>
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
          <button
            onClick={() => setLimit(prev => prev + 50)}
            className="px-6 py-2.5 bg-surface border border-border hover:border-primary/50 text-text rounded-full transition-all hover:shadow-lg hover:shadow-primary/5 text-sm font-medium"
          >
            Load More Activity
          </button>
        </div>
      )}
    </div>
  );
}
