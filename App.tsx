// App.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

import { initDatabase } from './src/utils/database';
import HomeScreen       from './src/screens/HomeScreen';
import ListsScreen      from './src/screens/ListsScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import ScannerScreen    from './src/screens/ScannerScreen';
import CatalogueScreen  from './src/screens/CatalogueScreen';
import SettingsScreen   from './src/screens/SettingsScreen';

// ─── SVG Line Icons ───────────────────────────────────────────────────────────
const ACTIVE   = '#4F46E5';
const INACTIVE = '#9CA3AF';

function IconHome({ focused }: { focused: boolean }) {
  const c = focused ? ACTIVE : INACTIVE;
  const w = focused ? '2' : '1.6';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path d="M1 9.5L11 2L21 9.5V20C21 20.6 20.6 21 20 21H15V15H7V21H2C1.4 21 1 20.6 1 20V9.5Z"
        stroke={c} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function IconLists({ focused }: { focused: boolean }) {
  const c = focused ? ACTIVE : INACTIVE;
  const w = focused ? '2' : '1.6';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x="3" y="2" width="16" height="19" rx="2"
        stroke={c} strokeWidth={w} strokeLinejoin="round" />
      <Line x1="7" y1="8"  x2="15" y2="8"  stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="7" y1="12" x2="15" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="7" y1="16" x2="11" y2="16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function IconScanner({ focused }: { focused: boolean }) {
  const c = focused ? ACTIVE : INACTIVE;
  const w = focused ? '2' : '1.6';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x="2" y="5" width="18" height="14" rx="2"
        stroke={c} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx="11" cy="12" r="3.5" stroke={c} strokeWidth={w} />
      <Path d="M8 5V4C8 3.4 8.4 3 9 3H13C13.6 3 14 3.4 14 4V5"
        stroke={c} strokeWidth={w} strokeLinejoin="round" />
    </Svg>
  );
}

// ── Catalogue icon: a tag/label shape ─────────────────────────────────────────
function IconCatalogue({ focused }: { focused: boolean }) {
  const c = focused ? ACTIVE : INACTIVE;
  const w = focused ? '2' : '1.6';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M3 3h7.5l8.5 8.5a2 2 0 010 2.83l-4.67 4.67a2 2 0 01-2.83 0L3 10.5V3z"
        stroke={c} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round"
      />
      <Circle cx="8" cy="8" r="1.5" fill={c} />
    </Svg>
  );
}

function IconSettings({ focused }: { focused: boolean }) {
  const c = focused ? ACTIVE : INACTIVE;
  const w = focused ? '2' : '1.6';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx="11" cy="11" r="3" stroke={c} strokeWidth={w} />
      <Path d="M11 2V4M11 18V20M2 11H4M18 11H20M4.2 4.2L5.6 5.6M16.4 16.4L17.8 17.8M4.2 17.8L5.6 16.4M16.4 5.6L17.8 4.2"
        stroke={c} strokeWidth={w} strokeLinecap="round" />
    </Svg>
  );
}

function TabIcon({ focused, label, Icon }: {
  focused: boolean;
  label: string;
  Icon: React.ComponentType<{ focused: boolean }>;
}) {
  return (
    <View style={styles.tabIconWrap}>
      <Icon focused={focused} />
      <Text
        numberOfLines={1}
        style={[styles.tabLabel, focused && styles.tabLabelFocused]}
      >
        {label}
      </Text>
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

function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
          height: 65 + Math.max(insets.bottom, 0),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 10,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Home"     Icon={IconHome}      /> }}
      />
      <Tab.Screen
        name="ListsTab"
        component={ListsStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Lists"    Icon={IconLists}     /> }}
      />
      <Tab.Screen
        name="ScannerTab"
        component={ScannerScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Scanner"  Icon={IconScanner}   /> }}
      />
      {/* CatalogueTab replaces the old InventoryTab.
          InventoryScreen had a silent bug — it showed items from whichever
          list was the scanner target, changing without telling the user.
          CatalogueScreen shows the global ProductCatalogue instead, which
          is a genuinely useful view: price history, scan frequency, quick
          add-to-list. No more ambiguity about which list you're looking at. */}
      <Tab.Screen
        name="CatalogueTab"
        component={CatalogueScreen}
        options={{
          headerShown: true,
          headerStyle:      { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '700', color: '#111827' },
          headerShadowVisible: false,
          title: 'Price History',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="History"  Icon={IconCatalogue} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Settings" Icon={IconSettings}  /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => { initDatabase(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelFocused: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});