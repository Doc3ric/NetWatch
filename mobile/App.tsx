import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SocketProvider } from './src/contexts/SocketContext';
import { Activity, Laptop, AlertTriangle, Settings } from 'lucide-react-native';

import DashboardScreen from './src/screens/DashboardScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0D1117',
    card: '#151A22',
    text: '#E2E8F0',
    border: '#2A3441',
    primary: '#00C896',
  },
};

export default function App() {
  return (
    <SocketProvider>
      <NavigationContainer theme={customDarkTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              let icon;
              if (route.name === 'Dashboard') {
                icon = <Activity color={color} size={size} />;
              } else if (route.name === 'Devices') {
                icon = <Laptop color={color} size={size} />;
              } else if (route.name === 'Alerts') {
                icon = <AlertTriangle color={color} size={size} />;
              } else if (route.name === 'Settings') {
                icon = <Settings color={color} size={size} />;
              }
              return icon;
            },
            tabBarActiveTintColor: '#00C896',
            tabBarInactiveTintColor: '#94A3B8',
            headerStyle: {
              backgroundColor: '#151A22',
              borderBottomColor: '#2A3441',
              borderBottomWidth: 1,
            },
            headerTintColor: '#E2E8F0',
            tabBarStyle: {
              backgroundColor: '#151A22',
              borderTopColor: '#2A3441',
            },
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Devices" component={DevicesScreen} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SocketProvider>
  );
}
