import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cleanOldExports } from '../export/export-frame';
export default function Layout() {
  useEffect(() => {
    cleanOldExports().catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#f7f3eb' },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
