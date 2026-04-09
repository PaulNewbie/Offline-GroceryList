// App.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initDatabase } from './src/utils/database';

import HomeScreen       from './src/screens/HomeScreen';
import ListsScreen      from './src/screens/ListsScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import ScannerScreen    from './src/screens/ScannerScreen';
import SettingsScreen   from './src/screens/SettingsScreen';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Lists: '📋', Scanner: '📷', Settings: '⚙️',
  };
  return (
    <View style={styles.tabIconWrap}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{icons[label]}</Text>
      <Text style={[styles.tabLabel,  focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

const HEADER = {
  headerStyle:         { backgroundColor: '#FFFFFF' },
  headerTintColor:     '#4F46E5',
  headerTitleStyle:    { fontWeight: '700' as const, color: '#111827' },
  headerShadowVisible: false,
};

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ListsStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="Lists"      component={ListsScreen}      options={{ title: 'My Lists' }} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'List', headerBackTitle: 'Lists' }} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="Home"       component={HomeScreen}       options={{ headerShown: false }} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'List', headerBackTitle: 'Home' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => { initDatabase(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarShowLabel: false }}>
            <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home"     focused={focused} /> }} />
            <Tab.Screen name="ListsTab"   component={ListsStack}   options={{ tabBarIcon: ({ focused }) => <TabIcon label="Lists"    focused={focused} /> }} />
            <Tab.Screen name="ScannerTab" component={ScannerScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="Scanner"  focused={focused} /> }} />
            <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} /> }} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar:          { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', height: Platform.OS === 'ios' ? 84 : 64, paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8, elevation: 0, shadowOpacity: 0 },
  tabIconWrap:     { alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabEmoji:        { fontSize: 20 },
  tabEmojiFocused: { transform: [{ scale: 1.1 }] },
  tabLabel:        { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  tabLabelFocused: { color: '#4F46E5', fontWeight: '700' },
});