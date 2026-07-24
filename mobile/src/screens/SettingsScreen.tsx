import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Settings, Bell, Server, Network } from 'lucide-react-native';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Server color="#94A3B8" size={18} />
          <Text style={styles.sectionTitle}>AGENT CONFIGURATION</Text>
        </View>
        
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Polling Interval (seconds)</Text>
          <View style={styles.inputMock}>
            <Text style={styles.inputText}>30</Text>
          </View>
        </View>
        
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Target Subnet</Text>
          <View style={styles.inputMock}>
            <Text style={styles.inputText}>(auto-detect)</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Bell color="#94A3B8" size={18} />
          <Text style={styles.sectionTitle}>ALERT THRESHOLDS</Text>
        </View>
        
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>High Latency (ms)</Text>
          <View style={styles.inputMock}>
            <Text style={styles.inputText}>100</Text>
          </View>
        </View>
        
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Packet Loss (%)</Text>
          <View style={styles.inputMock}>
            <Text style={styles.inputText}>5</Text>
          </View>
        </View>
      </View>

      <Text style={styles.note}>Note: Settings are currently read-only on mobile.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    padding: 16,
  },
  section: {
    backgroundColor: '#151A22',
    borderColor: '#2A3441',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3441',
    paddingBottom: 12,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    marginBottom: 8,
  },
  inputMock: {
    backgroundColor: '#0D1117',
    borderColor: '#2A3441',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  inputText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  note: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  }
});
