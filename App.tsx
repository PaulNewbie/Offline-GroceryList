// App.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // <-- 1. Add this import

import { initDatabase } from './src/utils/database';
import ScannerScreen from './src/screens/ScannerScreen';
import InventoryScreen from './src/screens/InventoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    // 2. Wrap NavigationContainer with SafeAreaProvider
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator 
          screenOptions={{ 
            headerStyle: { backgroundColor: '#1E1E1E' }, 
            headerTintColor: '#FFF',
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        >
          <Stack.Screen 
            name="Scanner" 
            component={ScannerScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Inventory" 
            component={InventoryScreen} 
            options={{ title: 'Your Grocery List' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}