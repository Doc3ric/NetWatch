'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    pollingIntervalSec: 30,
    subnetOverride: '',
    latencyWarningMs: 150,
    latencyCriticalMs: 300,
    packetLossWarningPct: 5
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, visible: boolean } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/settings`, { credentials: 'include' });
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (field: string, value: string | number) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pollingIntervalSec: parseInt(settings.pollingIntervalSec),
          latencyWarningMs: parseInt(settings.latencyWarningMs),
          latencyCriticalMs: parseInt(settings.latencyCriticalMs),
          packetLossWarningPct: parseInt(settings.packetLossWarningPct),
          subnetOverride: settings.subnetOverride || ''
        })
      });
      setToast({ message: 'Settings saved successfully', visible: true });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-background font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold border-b border-border pb-2 mb-4">Agent Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Polling Interval (seconds)</label>
              <input 
                type="number" 
                value={settings.pollingIntervalSec} 
                onChange={(e) => handleChange('pollingIntervalSec', e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Subnet Override</label>
              <input 
                type="text" 
                placeholder="e.g., 192.168.1.0/24 (leave blank for auto)" 
                value={settings.subnetOverride || ''}
                onChange={(e) => handleChange('subnetOverride', e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text placeholder-text-muted focus:border-primary focus:outline-none" 
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold border-b border-border pb-2 mb-4">Alert Thresholds</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">High Latency Warning (ms)</label>
              <input 
                type="number" 
                value={settings.latencyWarningMs} 
                onChange={(e) => handleChange('latencyWarningMs', e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">High Latency Critical (ms)</label>
              <input 
                type="number" 
                value={settings.latencyCriticalMs} 
                onChange={(e) => handleChange('latencyCriticalMs', e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Packet Loss Warning (%)</label>
              <input 
                type="number" 
                value={settings.packetLossWarningPct} 
                onChange={(e) => handleChange('packetLossWarningPct', e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text focus:border-primary focus:outline-none" 
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 bg-surface border border-border text-text px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-opacity duration-300 ${toast.visible ? 'opacity-100' : 'opacity-0'}`}>
          <Save className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
