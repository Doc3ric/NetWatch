'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  const fetchAlerts = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const url = filter === 'unresolved' ? `${backendUrl}/api/alerts?resolved=false` : `${backendUrl}/api/alerts`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const resolveAlert = async (id: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolved: true })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      fetchAlerts(); // refresh
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Network Alerts</h1>
        <div className="flex bg-surface border border-border rounded-lg p-1">
          <button 
            onClick={() => setFilter('unresolved')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === 'unresolved' ? 'bg-surface-hover text-text font-medium' : 'text-text-muted hover:text-text'}`}
          >
            Unresolved
          </button>
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-surface-hover text-text font-medium' : 'text-text-muted hover:text-text'}`}
          >
            All Alerts
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.id} className={`bg-surface border rounded-xl p-5 flex gap-4 ${!alert.resolved ? 'border-l-4 border-l-danger border-border' : 'border-border opacity-70'}`}>
            <div className="mt-1">
              {alert.type === 'new_device' ? (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${alert.severity === 'critical' ? 'bg-danger/10 border-danger/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                  <AlertTriangle className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-danger' : 'text-orange-500'}`} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{alert.type.replace('_', ' ').toUpperCase()}</h3>
                  <p className="text-text-muted mt-1">{alert.message}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-muted">{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</p>
                  {!alert.resolved && (
                    <button 
                      onClick={() => resolveAlert(alert.id)}
                      className="mt-3 flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary transition-colors border border-border bg-background px-3 py-1.5 rounded-lg"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Resolved
                    </button>
                  )}
                  {alert.resolved && (
                    <span className="mt-3 inline-block text-xs font-semibold text-primary uppercase tracking-wider">Resolved</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary opacity-50" />
            <p className="text-lg">No alerts found</p>
            <p className="text-sm">Your network is running smoothly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
