import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { Activity, Globe2, Router, Laptop, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen({ navigation }: any) {
  const { socket, isConnected } = useSocket();
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>({
    status: null,
    metrics: [],
    devices: [],
    alerts: []
  });

  const fetchData = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const [statusRes, metricsRes, devicesRes, alertsRes] = await Promise.all([
        fetch(`${backendUrl}/api/status`).then(res => res.json()),
        fetch(`${backendUrl}/api/metrics?range=1h`).then(res => res.json()),
        fetch(`${backendUrl}/api/devices`).then(res => res.json()),
        fetch(`${backendUrl}/api/alerts?resolved=false`).then(res => res.json())
      ]);
      
      setData({
        status: statusRes,
        metrics: metricsRes.reverse(),
        devices: devicesRes,
        alerts: alertsRes
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleUpdate = (update: any) => {
      if (update.type === 'speedtest_result') {
        setData((prev: any) => {
          const newMetrics = [...prev.metrics];
          if (newMetrics.length > 0) {
            newMetrics[newMetrics.length - 1] = {
              ...newMetrics[newMetrics.length - 1],
              ...update.metrics
            };
          }
          return { ...prev, metrics: newMetrics };
        });
        return;
      }

      setData((prev: any) => {
        const newMetrics = [...prev.metrics, update.metrics].slice(-100); 
        return {
          ...prev,
          devices: update.devices,
          metrics: newMetrics,
          status: { ...prev.status, network: { totalDevices: update.devices.length, onlineDevices: update.devices.filter((d:any)=>d.status==='online').length } }
        };
      });
    };

    socket.on('network:update', handleUpdate);
    return () => {
      socket.off('network:update', handleUpdate);
    };
  }, [socket]);

  const latestMetric = data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;

  const pingData = data.metrics.map((m: any) => m.pingMs || 0);
  const dlData = data.metrics.map((m: any) => m.downloadMbps || 0);
  const ulData = data.metrics.map((m: any) => m.uploadMbps || 0);

  const chartConfig = {
    backgroundColor: '#151A22',
    backgroundGradientFrom: '#151A22',
    backgroundGradientTo: '#151A22',
    color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
    strokeWidth: 2,
    propsForDots: { r: "0" },
  };

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C896" />}
    >
      
      {/* System Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SYSTEM STATUS</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.statusValuePrimary}>Online</Text>
            </View>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>System Uptime</Text>
            <Text style={styles.statusValueMono}>14d 2h 45m</Text>
          </View>
        </View>
      </View>

      {/* Performance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CURRENT PERFORMANCE</Text>
        <View style={styles.perfGrid}>
          <View style={styles.perfItem}>
            <Activity color="#94A3B8" size={16} />
            <Text style={styles.perfLabel}>Ping</Text>
            <Text style={styles.perfValue}>{latestMetric?.pingMs ? Math.round(latestMetric.pingMs) : '--'} ms</Text>
          </View>
          <View style={styles.perfItem}>
            <ArrowDownRight color="#00C896" size={16} />
            <Text style={styles.perfLabel}>Download</Text>
            <Text style={styles.perfValuePrimary}>{latestMetric?.downloadMbps ? latestMetric.downloadMbps.toFixed(1) : '--'} Mbps</Text>
          </View>
          <View style={styles.perfItem}>
            <ArrowUpRight color="#3B82F6" size={16} />
            <Text style={styles.perfLabel}>Upload</Text>
            <Text style={styles.perfValuePrimary}>{latestMetric?.uploadMbps ? latestMetric.uploadMbps.toFixed(1) : '--'} Mbps</Text>
          </View>
          <View style={styles.perfItem}>
            <AlertTriangle color="#F43F5E" size={16} />
            <Text style={styles.perfLabel}>Loss</Text>
            <Text style={styles.perfValue}>{latestMetric?.packetLossPct ? Math.round(latestMetric.packetLossPct) : '0'} %</Text>
          </View>
        </View>
      </View>

      {/* Latency Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>LATENCY (MS)</Text>
        {pingData.length > 0 ? (
          <LineChart
            data={{ labels: [], datasets: [{ data: pingData }] }}
            width={screenWidth - 48}
            height={140}
            chartConfig={chartConfig}
            bezier
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={false}
            withHorizontalLabels={false}
            style={styles.chart}
          />
        ) : (
          <Text style={styles.placeholderText}>No Data</Text>
        )}
      </View>

      {/* Bandwidth Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>BANDWIDTH USAGE (MBPS)</Text>
        {dlData.length > 0 ? (
          <LineChart
            data={{ 
              labels: [], 
              datasets: [
                { data: dlData, color: (o) => `rgba(0, 200, 150, ${o})` },
                { data: ulData, color: (o) => `rgba(59, 130, 246, ${o})` }
              ] 
            }}
            width={screenWidth - 48}
            height={140}
            chartConfig={chartConfig}
            bezier
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={false}
            withHorizontalLabels={false}
            style={styles.chart}
          />
        ) : (
          <Text style={styles.placeholderText}>No Data</Text>
        )}
      </View>

      {/* Devices Preview */}
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Devices')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>CONNECTED DEVICES</Text>
          <Text style={styles.linkText}>View All</Text>
        </View>
        {data.devices.slice(0, 4).map((dev: any) => (
          <View key={dev.id} style={styles.row}>
            <View style={styles.rowLeft}>
              {dev.type === 'router' ? <Router color="#94A3B8" size={16} /> : <Laptop color="#94A3B8" size={16} />}
              <Text style={styles.devName} numberOfLines={1}>{dev.vendor || dev.name}</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: dev.status === 'online' ? '#00C896' : '#94A3B8' }]} />
              <Text style={styles.devPing}>{dev.lastPingMs != null ? Math.round(dev.lastPingMs) : '--'} ms</Text>
            </View>
          </View>
        ))}
      </TouchableOpacity>

      {/* Alerts Preview */}
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Alerts')}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>RECENT ALERTS</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data.alerts.length}</Text>
          </View>
        </View>
        {data.alerts.slice(0, 3).map((al: any) => (
          <View key={al.id} style={styles.row}>
            {al.type === 'new_device' ? <Activity color="#00C896" size={16} /> : <AlertTriangle color={al.severity === 'critical' ? '#F43F5E' : '#FB923C'} size={16} />}
            <Text style={styles.alertText} numberOfLines={1}>{al.message}</Text>
          </View>
        ))}
        {data.alerts.length === 0 && <Text style={styles.placeholderText}>No unresolved alerts.</Text>}
      </TouchableOpacity>
      
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    padding: 12,
  },
  card: {
    backgroundColor: '#151A22',
    borderColor: '#2A3441',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  linkText: {
    color: '#00C896',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusGrid: {
    flexDirection: 'row',
    marginTop: 12,
  },
  statusItem: {
    flex: 1,
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C896',
  },
  statusValuePrimary: {
    color: '#00C896',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusValueMono: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 16,
  },
  perfItem: {
    width: '45%',
    marginBottom: 8,
  },
  perfLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  perfValue: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: 'bold',
  },
  perfValuePrimary: {
    color: '#00C896',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chart: {
    marginTop: 8,
    marginLeft: -16,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3441',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  devName: {
    color: '#E2E8F0',
    fontSize: 14,
    flex: 1,
  },
  devPing: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  badge: {
    backgroundColor: '#F43F5E20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#F43F5E',
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertText: {
    color: '#E2E8F0',
    fontSize: 13,
    flex: 1,
    marginLeft: 8,
  }
});
