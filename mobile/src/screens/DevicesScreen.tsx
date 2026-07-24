import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { Router, Laptop, WifiOff } from 'lucide-react-native';

export default function DevicesScreen() {
  const { socket } = useSocket();
  const [devices, setDevices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/devices`);
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleUpdate = (update: any) => {
      if (update.type === 'speedtest_result') return;
      setDevices(update.devices);
    };

    socket.on('network:update', handleUpdate);
    return () => {
      socket.off('network:update', handleUpdate);
    };
  }, [socket]);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.rowLeft}>
          {item.type === 'router' ? <Router color="#94A3B8" size={20} /> : <Laptop color="#94A3B8" size={20} />}
          <Text style={styles.devName} numberOfLines={1}>{item.vendor || item.name}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: item.status === 'online' ? '#00C896' : '#94A3B8' }]} />
          <Text style={styles.statusText}>{item.status === 'online' ? 'Online' : 'Offline'}</Text>
        </View>
      </View>
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>IP ADDRESS</Text>
          <Text style={styles.detailValue}>{item.ip}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>MAC ADDRESS</Text>
          <Text style={styles.detailValue}>{item.mac}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>PING</Text>
          <Text style={styles.detailValue}>{item.lastPingMs != null ? Math.round(item.lastPingMs) : '--'} ms</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C896" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <WifiOff color="#94A3B8" size={48} />
            <Text style={styles.emptyText}>No devices found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#151A22',
    borderColor: '#2A3441',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  devName: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
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
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailValue: {
    color: '#E2E8F0',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  }
});
