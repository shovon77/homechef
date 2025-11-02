'use client';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import NavBar from '../components/NavBar';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NavBar />
      <Stack
        screenOptions={{
          headerShown: false, // hide expo-router's default headers
        }}
      />
    </View>
  );
}
