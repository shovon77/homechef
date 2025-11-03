#!/usr/bin/env bash
set -e
mkdir -p .backup app/auth

# 0) backup existing files we might touch
[ -f app/auth/index.tsx ] && cp app/auth/index.tsx ".backup/auth_index.tsx.$(date +%s)" || true

# 1) Add a dedicated magic-link page
cat > app/auth/magic.tsx <<'EOF'
'use client';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function MagicLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const redirectTo = (() => {
    try {
      if (Platform.OS !== 'web') return undefined as any;
      const origin = window.location.origin;
      return `${origin}/auth/callback`;
    } catch { return undefined as any; }
  })();

  async function sendLink() {
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setSent(true);
    } catch (e:any) {
      setErr(e.message || String(e));
    }
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
            Make sure your Supabase Auth “Redirect URLs” includes {redirectTo || '/auth/callback'}.
          </Text>
          {err ? <Text style={{color:'red'}}>{err}</Text> : null}
        </>
      )}
    </View>
  );
}
EOF

# 2) Add a callback page to complete the login after clicking the email link
cat > app/auth/callback.tsx <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finalizing sign-in…');

  useEffect(() => {
    // Supabase handles hash tokens automatically; just wait for a session then redirect.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setMsg('Signed in! Redirecting…');
        router.replace('/admin');
      } else {
        setMsg('No active session. Try the email link again or sign in.');
      }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16}}>
      <Text style={{color:'#f8fafc'}}>{msg}</Text>
    </View>
  );
}
EOF

# 3) (Optional) add a quick link from your existing auth page if it exists
# Only append a small “Use email link” note if not already present
if [ -f app/auth/index.tsx ] && ! grep -q "href=\"/auth/magic\"" app/auth/index.tsx; then
  echo "🔧 Appending a link to /auth/magic inside app/auth/index.tsx"
  cat >> app/auth/index.tsx <<'EOF'

/* ---------- Magic link hint ---------- */
{Platform.OS === 'web' ? (
  // @ts-ignore
  <a href="/auth/magic" style={{ color:'#0ea5e9', marginTop:12, display:'inline-block' }}>
    Use email link instead (no password)
  </a>
) : null}
EOF
fi

# 4) Clear caches
rm -rf .expo .cache node_modules/.cache 2>/dev/null || true

echo "✅ Magic-link login added:"
echo "   - /auth/magic (send link)"
echo "   - /auth/callback (receives link)"
echo "👉 In Supabase: Auth → URL Configuration → add your Replit origin + /auth/callback to Redirect URLs."
