#!/usr/bin/env bash
set -e
mkdir -p .backup components constants app/admin

# 0) Backups if files already exist
[ -f components/AdminGuard.tsx ] && cp components/AdminGuard.tsx ".backup/AdminGuard.tsx.$(date +%s)"
[ -f constants/admin.ts ] && cp constants/admin.ts ".backup/admin.ts.$(date +%s)"
[ -f app/admin/index.tsx ] && cp app/admin/index.tsx ".backup/admin_index.tsx.$(date +%s)"

# 1) Admin allow-list (edit the emails below)
cat > constants/admin.ts <<'EOF'
/**
 * Admin allow-list. Put your admin emails here.
 * Example: ['you@example.com', 'cofounder@homechef.ca']
 */
export const ADMIN_EMAILS: string[] = [
  'shovonmahmud.sm@gmail.com'
];
EOF

# 2) Guard component – only renders children if the signed-in user is in ADMIN_EMAILS
cat > components/AdminGuard.tsx <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAILS } from '../constants/admin';

export default function AdminGuard({ children }:{ children: JSX.Element }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || '';
        setAllowed(ADMIN_EMAILS.includes(email));
      } catch (e:any) {
        setErr(e.message || String(e));
        setAllowed(false);
      }
    })();
  }, []);

  if (allowed === null) {
    return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
      <Text style={{ color:'#cbd5e1' }}>Checking admin access…</Text>
    </View>;
  }
  if (!allowed) {
    return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
      <Text style={{ color:'red', fontWeight:'700' }}>Admin access required</Text>
      {err ? <Text style={{ color:'#cbd5e1', marginTop:8 }}>{err}</Text> : null}
    </View>;
  }
  return children;
}
EOF

# 3) Admin Page with tabs and actions
cat > app/admin/index.tsx <<'EOF'
'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import AdminGuard from '../../components/AdminGuard';
import { Tabs } from '../../components/Tabs';

type Chef = { id:number; name?:string|null; location?:string|null; active?:boolean|null; phone?:string|null; };
type Submission = { id:number; name?:string|null; phone?:string|null; location?:string|null; created_at?:string|null; };
type Order = { id:number; user_id?:string|null; chef_id?:number|null; status?:string|null; total?:number|null; created_at?:string|null; };
type AppUser = { id:string; email?:string|null; name?:string|null; is_chef?:boolean|null };

function Row({ children }:{ children: React.ReactNode }) {
  return <View style={{ backgroundColor:'#111827', borderColor:'#1f4f3f', borderWidth:1, borderRadius:12, padding:12, marginBottom:10 }}>{children}</View>
}
function Btn({ title, onPress, kind='primary' }:{ title:string; onPress:()=>void; kind?:'primary'|'danger'|'muted' }) {
  const bg = kind==='danger' ? '#ef4444' : kind==='muted' ? '#334155' : '#22c55e';
  const fg = kind==='danger' ? '#fff' : '#000';
  return <TouchableOpacity onPress={onPress} style={{ backgroundColor:bg, paddingVertical:8, paddingHorizontal:12, borderRadius:8, alignSelf:'flex-start' }}>
    <Text style={{ color:fg, fontWeight:'800' }}>{title}</Text>
  </TouchableOpacity>;
}

export default function AdminPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function loadAll() {
    setLoading(true); setErr(null);
    try {
      const [{ data: chefRows }, { data: subRows }, { data: orderRows }, { data: userRows }] = await Promise.all([
        supabase.from('chefs').select('id,name,location,phone,active').order('id', { ascending:true }).limit(500),
        supabase.from('chef_submissions').select('id,name,phone,location,created_at').order('created_at', { ascending:false }).limit(500),
        supabase.from('orders').select('id,user_id,chef_id,status,total,created_at').order('created_at', { ascending:false }).limit(500),
        supabase.from('users').select('id,email,name,is_chef').limit(1000),
      ]);
      setChefs((chefRows as any[])||[]);
      setSubs((subRows as any[])||[]);
      setOrders((orderRows as any[])||[]);
      setUsers((userRows as any[])||[]);
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ loadAll(); }, []);

  async function toggleChefActive(id:number, next:boolean) {
    await supabase.from('chefs').update({ active: next }).eq('id', id);
    setChefs(cs => cs.map(c => c.id===id ? { ...c, active: next } : c));
  }
  async function approveSubmission(id:number) {
    await supabase.from('chef_submissions').update({ approved: true }).eq('id', id);
    setSubs(ss => ss.filter(s => s.id !== id));
  }
  async function rejectSubmission(id:number) {
    await supabase.from('chef_submissions').update({ approved: false }).eq('id', id);
    setSubs(ss => ss.filter(s => s.id !== id));
  }

  const currentOrders   = useMemo(()=>orders.filter(o => (o.status||'').toLowerCase()==='current' || (o.status||'').toLowerCase()==='in_progress'),[orders]);
  const completedOrders = useMemo(()=>orders.filter(o => (o.status||'').toLowerCase()==='completed'),[orders]);
  const cancelledOrders = useMemo(()=>orders.filter(o => (o.status||'').toLowerCase()==='cancelled' || (o.status||'').toLowerCase()==='canceled'),[orders]);
  const nonChefs        = useMemo(()=>users.filter(u => !u.is_chef),[users]);

  const ChefsTab = (
    <ScrollView contentContainerStyle={{ padding:16 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:22, marginBottom:10 }}>Chefs</Text>
      {chefs.map(c => (
        <Row key={c.id}>
          <Text style={{ color:'#f8fafc', fontWeight:'800' }}>{c.name || `Chef #${c.id}`}</Text>
          <Text style={{ color:'#cbd5e1' }}>{c.location || ''}{c.phone ? ` · ${c.phone}` : ''}</Text>
          <View style={{ height:8 }} />
          {c.active ? (
            <Btn title="Deactivate" kind="danger" onPress={()=>toggleChefActive(c.id, false)} />
          ) : (
            <Btn title="Activate" onPress={()=>toggleChefActive(c.id, true)} />
          )}
        </Row>
      ))}
      {!chefs.length ? <Text style={{ color:'#94a3b8' }}>No chefs found.</Text> : null}
    </ScrollView>
  );

  const SubmissionsTab = (
    <ScrollView contentContainerStyle={{ padding:16 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:22, marginBottom:10 }}>Chef Submissions</Text>
      {subs.map(s => (
        <Row key={s.id}>
          <Text style={{ color:'#f8fafc', fontWeight:'800' }}>{s.name || `Submission #${s.id}`}</Text>
          <Text style={{ color:'#cbd5e1' }}>{s.location || ''}{s.phone ? ` · ${s.phone}` : ''}</Text>
          {s.created_at ? <Text style={{ color:'#64748b', marginTop:4, fontSize:12 }}>{new Date(s.created_at).toLocaleString()}</Text> : null}
          <View style={{ height:8 }} />
          <View style={{ flexDirection:'row', gap:8 }}>
            <Btn title="Approve" onPress={()=>approveSubmission(s.id)} />
            <Btn title="Reject" kind="danger" onPress={()=>rejectSubmission(s.id)} />
          </View>
        </Row>
      ))}
      {!subs.length ? <Text style={{ color:'#94a3b8' }}>No submissions pending.</Text> : null}
    </ScrollView>
  );

  const OrdersTab = (
    <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:22 }}>Orders</Text>
      <View>
        <Text style={{ color:'#eab308', fontWeight:'800', marginBottom:8 }}>Current</Text>
        {currentOrders.length ? currentOrders.map(o=>(
          <Row key={`cur_${o.id}`}><OrderLine o={o} /></Row>
        )) : <Text style={{ color:'#94a3b8' }}>None</Text>}
      </View>
      <View>
        <Text style={{ color:'#22c55e', fontWeight:'800', marginBottom:8 }}>Completed</Text>
        {completedOrders.length ? completedOrders.map(o=>(
          <Row key={`cmp_${o.id}`}><OrderLine o={o} /></Row>
        )) : <Text style={{ color:'#94a3b8' }}>None</Text>}
      </View>
      <View>
        <Text style={{ color:'#ef4444', fontWeight:'800', marginBottom:8 }}>Cancelled</Text>
        {cancelledOrders.length ? cancelledOrders.map(o=>(
          <Row key={`can_${o.id}`}><OrderLine o={o} /></Row>
        )) : <Text style={{ color:'#94a3b8' }}>None</Text>}
      </View>
    </ScrollView>
  );

  function OrderLine({ o }:{ o:Order }) {
    return (
      <View>
        <Text style={{ color:'#f8fafc', fontWeight:'800' }}>Order #{o.id}</Text>
        <Text style={{ color:'#cbd5e1' }}>Chef: {o.chef_id ?? '-' } · User: {o.user_id ?? '-' } · $ {o.total ?? 0}</Text>
        {o.created_at ? <Text style={{ color:'#64748b', fontSize:12, marginTop:4 }}>{new Date(o.created_at).toLocaleString()} · {o.status}</Text> : null}
      </View>
    );
  }

  const UsersTab = (
    <ScrollView contentContainerStyle={{ padding:16 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:22, marginBottom:10 }}>Users (non-chefs)</Text>
      {nonChefs.map(u => (
        <Row key={u.id}>
          <Text style={{ color:'#f8fafc', fontWeight:'800' }}>{u.name || u.email || u.id}</Text>
          <Text style={{ color:'#cbd5e1' }}>{u.email || ''}</Text>
        </Row>
      ))}
      {!nonChefs.length ? <Text style={{ color:'#94a3b8' }}>No non-chef users.</Text> : null}
    </ScrollView>
  );

  const content = (
    <View style={{ width:'100%', maxWidth:1200, backgroundColor:'#0f172a', borderRadius:16, padding:16, gap:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:24 }}>Admin</Text>
        <TouchableOpacity onPress={loadAll} style={{ backgroundColor:'#0ea5e9', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'800' }}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>
      {err ? <Text style={{ color:'red' }}>{err}</Text> : null}
      <Tabs
        initial={0}
        tabs={[
          { key:'chefs',       title:'Chefs',        content: ChefsTab },
          { key:'submissions', title:'Submissions',  content: SubmissionsTab },
          { key:'orders',      title:'Orders',       content: OrdersTab },
          { key:'users',       title:'Users',        content: UsersTab },
        ]}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ alignItems:'center', padding:20 }}>
      <AdminGuard>{content}</AdminGuard>
    </ScrollView>
  );
}
EOF

# 4) Clear caches so new route shows up
rm -rf .expo .cache node_modules/.cache 2>/dev/null || true

echo "✅ Admin page added at /admin. Edit constants/admin.ts to set your admin email(s)."
