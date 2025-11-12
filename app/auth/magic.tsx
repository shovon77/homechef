'use client';
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { getEmailRedirect, redirectAfterLogin } from '../../lib/authRedirect';

export default function MagicLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setChecking(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_chef, role')
        .eq('id', session.user.id)
        .maybeSingle();
      redirectAfterLogin(profile ?? {});
    })();
  }, []);

  async function sendLink() {
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getEmailRedirect() }
      });
      if (error) throw error;
      setSent(true);
    } catch (e:any) {
      setErr(e.message || String(e));
    }
  }

  if (checking) {
    return null;
  }

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16, gap:12}}>
      <Text style={{color:'#f8fafc', fontSize:22, fontWeight:'900'}}>Login via Email Link</Text>
      {sent ? (
        <>
          <Text style={{color:'#cbd5e1', textAlign:'center'}}>
            If that email exists, we sent a sign-in link. Open it and you'll be redirected back here.
          </Text>
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{width:320, backgroundColor:'#0f172a', color:'#e2e8f0', padding:10, borderRadius:8, borderWidth:1, borderColor:'#1f2937'}}
          />
          <TouchableOpacity onPress={sendLink} style={{backgroundColor:'#0ea5e9', paddingVertical:10, paddingHorizontal:16, borderRadius:8}}>
            <Text style={{color:'#fff', fontWeight:'800'}}>Send login link</Text>
          </TouchableOpacity>
          <Text style={{color:'#94a3b8', fontSize:12, textAlign:'center', maxWidth:360}}>
            Make sure your Supabase Auth "Redirect URLs" includes {getEmailRedirect()}.
          </Text>
          {err ? <Text style={{color:'red'}}>{err}</Text> : null}
        </>
      )}
    </View>
  );
}
