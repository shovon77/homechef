'use client';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function NavBar() {
  const router = useRouter();

  return (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#111827', // dark gray
      }}
    >
      <TouchableOpacity onPress={() => router.push('/')}>
        <Text style={{ color: '#fbbf24', fontSize: 20, fontWeight: 'bold' }}>🍲 HomeChef</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/auth')}
        style={{
          backgroundColor: '#f59e0b',
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#000', fontWeight: '600' }}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}
