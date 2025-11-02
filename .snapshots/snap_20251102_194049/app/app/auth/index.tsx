'use client';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function AuthStart() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const disabled = !email || !password;

  const next = () => {
    router.push({ pathname: '/auth/complete', params: { email, password } });
  };

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', gap:12, padding:16 }}>
      <Text style={{ fontSize:24, fontWeight:'bold' }}>Create your account</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ width:260, borderWidth:1, borderColor:'#333', borderRadius:8, padding:10, color:'#fff' }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ width:260, borderWidth:1, borderColor:'#333', borderRadius:8, padding:10, color:'#fff' }}
      />

      <TouchableOpacity
        onPress={next}
        disabled={disabled}
        style={{ backgroundColor: disabled ? '#9ca3af' : '#f59e0b', paddingVertical:10, paddingHorizontal:18, borderRadius:8, marginTop:8 }}
      >
        <Text style={{ fontWeight:'600' }}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/auth/signin')}>
        <Text style={{ color:'#60a5fa', marginTop:10 }}>Already have an account? Sign in</Text>
      </TouchableOpacity>

      <Text style={{ opacity:0.8, marginTop:6, textAlign:'center', maxWidth:280 }}>
        Next: choose your role and finish sign up.
      </Text>
    </View>
  );
}
