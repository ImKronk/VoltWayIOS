import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from './src/state/AppContext';
import MapScreen from './src/screens/MapScreen';
import StationDetailScreen from './src/screens/StationDetailScreen';
import RouteScreen from './src/screens/RouteScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import PredictionScreen from './src/screens/PredictionScreen';
import BatteryScreen from './src/screens/BatteryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Map" component={MapScreen} />
              <Stack.Screen name="StationDetail" component={StationDetailScreen} />
              <Stack.Screen name="Route" component={RouteScreen} />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen name="Prediction" component={PredictionScreen} />
              <Stack.Screen name="Battery" component={BatteryScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
