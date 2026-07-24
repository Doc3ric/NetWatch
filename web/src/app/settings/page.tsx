'use client';

import { Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-background font-medium px-4 py-2 rounded-md transition-colors">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold border-b border-border pb-2 mb-4">Agent Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Polling Interval (seconds)</label>
              <input type="number" defaultValue={30} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Subnet Override</label>
              <input type="text" placeholder="e.g., 192.168.1.0/24 (leave blank for auto)" className="w-full bg-background border border-border rounded-md px-3 py-2 text-text placeholder-text-muted focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold border-b border-border pb-2 mb-4">Alert Thresholds</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">High Latency Warning (ms)</label>
              <input type="number" defaultValue={150} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">High Latency Critical (ms)</label>
              <input type="number" defaultValue={300} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Packet Loss Warning (%)</label>
              <input type="number" defaultValue={5} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
