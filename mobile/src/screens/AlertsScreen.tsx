import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react-native';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');

  const fetchAlerts = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const url = filter === 'unresolved' 
        ? `${backendUrl}/api/alerts?resolved=false`
        : `${backendUrl}/api/alerts`;
      const res = await fetch(url);
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [filter]);

  const resolveAlert = async (id: string) => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true })
      });
      fetchAlerts();
    } catch (err) {
      Alert.alert('Error', 'Failed to resolve alert');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.severity === 'critical' ? styles.cardCritical : styles.cardWarning]}>
      <View style={styles.cardHeader}>
        <View style={styles.rowLeft}>
          {item.type === 'new_device' ? <Activity color="#00C896" size={20} /> : <AlertTriangle color={item.severity === 'critical' ? '#F43F5E' : '#FB923C'} size={20} />}
          <Text style={styles.alertType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
        </View>
        <Text style={styles.alertTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.alertMessage}>{item.message}</Text>
      
      {!item.resolved && (
        <TouchableOpacity style={styles.resolveButton} onPress={() => resolveAlert(item.id)}>
          <CheckCircle color="#00C896" size={16} />
          <Text style={styles.resolveText}>Mark Resolved</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterTabs}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'unresolved' && styles.tabActive]}
          onPress={() => setFilter('unresolved')}
        >
          <Text style={[styles.tabText, filter === 'unresolved' && styles.tabTextActive]}>Unresolved</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'all' && styles.tabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>All Alerts</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C896" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckCircle color="#00C896" size={48} />
            <Text style={styles.emptyText}>All clear! No alerts.</Text>
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
  filterTabs: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#151A22',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3441',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#2A3441',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#E2E8F0',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  cardCritical: {
    borderColor: '#2A3441',
    borderLeftColor: '#F43F5E',
  },
  cardWarning: {
    borderColor: '#2A3441',
    borderLeftColor: '#FB923C',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertType: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  alertTime: {
    color: '#94A3B8',
    fontSize: 12,
  },
  alertMessage: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00C89615',
    paddingVertical: 10,
    borderRadius: 8,
  },
  resolveText: {
    color: '#00C896',
    fontSize: 14,
    fontWeight: 'bold',
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
