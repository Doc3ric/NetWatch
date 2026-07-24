import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SocketProvider } from './src/contexts/SocketContext';
import { Activity, Laptop, AlertTriangle, Settings } from 'lucide-react-native';

import DashboardScreen from './src/screens/DashboardScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
export const navigationRef = createNavigationContainerRef();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C896',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    try {
      // In a real EAS build, we'd pass projectId. In Expo Go, this works automatically.
      const projectId = undefined; // replace with Constants.expoConfig?.extra?.eas?.projectId if configured
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: Platform.OS }),
      }).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }
}

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
  useEffect(() => {
    registerForPushNotificationsAsync();

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Alerts' as never);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return (
    <SocketProvider>
      <NavigationContainer theme={customDarkTheme} ref={navigationRef}>
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
