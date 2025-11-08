// app/chef/dashboard.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { uploadToBucket } from '../../lib/upload'
import FilePicker from '../../components/FilePicker'

const C = {
  bg: '#F7F9F8',
  panel: '#FFFFFF',
  card: '#F2F5F3',
  border: '#DCE6E0',
  text: '#0F1F17',
  sub: '#59776A',
  accent: '#FBBF24',
  primary: '#2DA97B',
  danger: '#B42318',
  btnTextDark: '#0B1F17',
}

type ChefRow = { id: number; name: string; email?: string|null; bio?: string|null; photo?: string|null }
type DishRow = { id: number; chef_id: number|null; name: string; price: number; description?: string|null; image?: string|null; thumbnail?: string|null; chef?: string|null }

export default function ChefDashboard() {
  const router = useRouter()
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [chef,setChef]=useState<ChefRow|null>(null)
  const [dishes,setDishes]=useState<DishRow[]>([])
  const [msg,setMsg]=useState<string|null>(null)
  const [err,setErr]=useState<string|null>(null)
  const [name,setName]=useState(''); const [bio,setBio]=useState(''); const [photo,setPhoto]=useState<string|undefined>(undefined)

  useEffect(()=>{;(async()=>{
    setLoading(true); setErr(null)
    try{
      const { data:auth } = await supabase.auth.getUser()
      if(!auth?.user){ router.replace('/auth'); return }
      const email = auth.user.email
      if(!email) throw new Error('Missing email on session')

      let me = (await supabase.from('chefs').select('*').eq('email',email).maybeSingle()).data as ChefRow|null
      if(!me){
        const defaultName = auth.user.user_metadata?.name || email.split('@')[0]
        const ins = await supabase.from('chefs').insert({ name: defaultName, email }).select('*').single()
        if(ins.error) throw ins.error
        me = ins.data as ChefRow
      }
      setChef(me); setName(me.name||''); setBio(me.bio||''); setPhoto(me.photo||undefined)

      const d = await supabase.from('dishes').select('*').eq('chef_id', me.id).order('id',{ascending:true})
      if(d.error) throw d.error
      setDishes((d.data||[]) as DishRow[])
    }catch(e:any){ setErr(e.message||String(e)) } finally { setLoading(false) }
  })()},[])

  async function saveProfile(){
    if(!chef) return
    setSaving(true); setMsg(null); setErr(null)
    try{
      const { error } = await supabase.from('chefs').update({ name: name||chef.name, bio: bio??null, photo: photo??null }).eq('id', chef.id)
      if(error) throw error
      setMsg('Profile saved ✓')
    }catch(e:any){ setErr('Save failed: '+(e.message||String(e))) } finally{ setSaving(false) }
  }

  async function handleAvatarPick(file: File){
    if(!chef) return
    setSaving(true); setMsg(null); setErr(null)
    try{
      const { publicUrl } = await uploadToBucket('public-assets', file, `chefs/${chef.id}/avatar`)
      setPhoto(publicUrl)
      const { error } = await supabase.from('chefs').update({ photo: publicUrl }).eq('id', chef.id)
      if(error) throw error
      setMsg('Avatar updated ✓')
    }catch(e:any){ setErr('Avatar upload failed: '+(e.message||String(e))) } finally{ setSaving(false) }
  }

  async function createDish(d:{name:string; price:number; description?:string; file?:File|null; preview?:string}){
    if(!chef) return
    setSaving(true); setMsg(null); setErr(null)
    try{
      const ins = await supabase.from('dishes').insert({
        chef_id: chef.id, chef: name||chef.name, name: d.name, price: d.price, description: d.description||null
      }).select('*').single()
      if(ins.error) throw ins.error
      const created = ins.data as DishRow

      if(d.file){
        const { publicUrl } = await uploadToBucket('dish-images', d.file, `chefs/${chef.id}/dishes/${created.id}`)
        const up = await supabase.from('dishes').update({ image: publicUrl, thumbnail: publicUrl }).eq('id', created.id)
        if(up.error) throw up.error
        created.image = publicUrl; created.thumbnail = publicUrl
      }

      setDishes(p=>[...p, created]); setMsg('Dish created ✓')
    }catch(e:any){ setErr('Create dish failed: '+(e.message||String(e))) } finally{ setSaving(false) }
  }

  /** Clean, safe update (no extra columns sent) */
  async function updateDish(p: { id:number; name?:string; price?:number|string; description?:string; file?:File|null; preview?:string }){
    if(!chef) return
    setSaving(true); setMsg(null); setErr(null)
    try{
      const payload: any = {}

      if (typeof p.name !== 'undefined')        payload.name = p.name
      if (typeof p.price !== 'undefined' && p.price !== null && p.price !== '') {
        const n = Number(p.price)
        if (!Number.isFinite(n)) throw new Error('Price must be a number')
        payload.price = n
      }
      if (typeof p.description !== 'undefined') payload.description = p.description || null

      // If a new image is chosen, upload first and include URLs
      if (p.file) {
        const { publicUrl } = await uploadToBucket('dish-images', p.file, `chefs/${chef!.id}/dishes/${p.id}`)
        payload.image = publicUrl
        payload.thumbnail = publicUrl
      }

      // Perform update with ONLY allowed fields
      const { error } = await supabase.from('dishes').update(payload).eq('id', p.id)
      if (error) throw error

      // Reflect in local UI immediately
      setDishes(prev =>
        prev.map(d =>
          d.id === p.id ? { ...d, ...payload } as DishRow : d
        )
      )

      setMsg('Dish updated ✓')
    }catch(e:any){ setErr('Update dish failed: '+(e.message||String(e))) } finally{ setSaving(false) }
  }

  async function deleteDish(id:number){
    if(!chef) return
    setSaving(true); setMsg(null); setErr(null)
    try{
      const { error } = await supabase.from('dishes').delete().eq('id', id)
      if(error) throw error
      setDishes(prev => prev.filter(d => d.id !== id))
      setMsg('Dish deleted ✓')
    }catch(e:any){ setErr('Delete failed: '+(e.message||String(e))) } finally{ setSaving(false) }
  }

  if(loading){
    return <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}><Text style={{ color:C.sub }}>Loading…</Text></View>
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:16, gap:16 }}>
      <Text style={{ color:C.text, fontSize:24, fontWeight:'900' }}>Chef Dashboard</Text>
      <View style={{ height:3, width:160, backgroundColor:C.accent, marginTop:6, borderRadius:3 }} />

      {msg ? <Banner color={C.primary} text={msg} /> : null}
      {err ? <Banner color={C.danger} text={err} /> : null}

      {/* Profile */}
      <Card>
        <Title>Your Profile</Title>

        <View style={{ flexDirection:'row', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <Image source={{ uri: photo || 'https://placehold.co/128x128?text=Avatar' }} style={{ width:96, height:96, borderRadius:48, borderWidth:1, borderColor:C.border, backgroundColor:'#EEE' }} />
          <FilePicker label="Upload avatar" onFile={handleAvatarPick} accept="image/*" />
        </View>

        <Field label="Display name">
          <Input value={name} onChangeText={setName} placeholder="e.g., Chef Amira" />
        </Field>

        <Field label="Short bio">
          <Input value={bio} onChangeText={setBio} placeholder="Your cooking story…" multiline />
        </Field>

        <PrimaryButton onPress={saveProfile} disabled={saving} title={saving?'Saving…':'Save profile'} />
      </Card>

      {/* Dishes */}
      <Card>
        <Title>Your Dishes</Title>
        <NewDishForm onCreate={createDish} saving={saving} />
        <Divider />
        <View style={{ gap:12 }}>
          {dishes.length===0 ? <Text style={{ color:C.sub }}>No dishes yet.</Text> : null}
          {dishes.map(d => <DishEditor key={d.id} dish={d} onSave={updateDish} onDelete={deleteDish} />)}
        </View>
      </Card>
    </ScrollView>
  )
}

/* UI helpers */
function Card({ children }:{ children: React.ReactNode }){ return <View style={{ backgroundColor:C.panel, borderColor:C.border, borderWidth:1, borderRadius:16, padding:16, gap:12 }}>{children}</View> }
function Title({ children }:{ children: React.ReactNode }){ return <Text style={{ color:C.text, fontWeight:'800', fontSize:18 }}>{children}</Text> }
function Divider(){ return <View style={{ height:1, backgroundColor:C.border, marginVertical:8 }} /> }
function Banner({ color, text }:{ color:string; text:string }){ return <View style={{ backgroundColor:'#fff', borderLeftColor:color, borderLeftWidth:6, borderRadius:8, padding:10, borderColor:C.border, borderWidth:1 }}><Text style={{ color:C.text }}>{text}</Text></View> }
function Field({ label, children }:{ label:string; children:React.ReactNode }){ return <View style={{ gap:6 }}><Text style={{ color:C.sub }}>{label}</Text>{children}</View> }
function Input(props:any){ return <TextInput {...props} placeholderTextColor="#7C9B8E" style={[{ backgroundColor:C.card, color:C.text, borderColor:C.border, borderWidth:1, borderRadius:10, padding:12, minHeight:48 }, props.multiline && { minHeight:76 }]} /> }
function PrimaryButton({ title, onPress, disabled }:{ title:string; onPress:()=>void; disabled?:boolean }){ return <TouchableOpacity onPress={onPress} disabled={!!disabled} style={{ backgroundColor: disabled? '#9CCFBA' : C.primary, padding:12, borderRadius:10, alignSelf:'flex-start' }}><Text style={{ color:C.btnTextDark, fontWeight:'900' }}>{title}</Text></TouchableOpacity> }

/* Dish forms */
function L({ children }:{ children:React.ReactNode }){ return <Text style={{ color:C.sub }}>{children}</Text> }

function NewDishForm({ onCreate, saving }:{ onCreate:(d:{name:string; price:number; description?:string; file?:File|null; preview?:string})=>void; saving:boolean }){
  const [name,setName]=useState(''); const [price,setPrice]=useState(''); const [description,setDescription]=useState(''); const [file,setFile]=useState<File|null>(null); const [preview,setPreview]=useState<string|null>(null)
  const valid = name.trim().length>0 && Number(price)>0
  return (
    <View style={{ backgroundColor:C.card, borderColor:C.border, borderWidth:1, borderRadius:12, padding:12, gap:8 }}>
      <Text style={{ color:C.text, fontWeight:'700' }}>Add a new dish</Text>
      <View style={{ flexDirection:'row', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
        <View style={{ flex:1, minWidth:220 }}>
          <L>Name</L>
          <Input value={name} onChangeText={setName} placeholder="Chicken Biryani" />
        </View>
        <View style={{ width:140 }}>
          <L>Price</L>
          <Input value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="19.99" />
        </View>
        <View style={{ minWidth:220, alignItems:'flex-start' }}>
          <L>Photo</L>
          <FilePicker label="Choose image" onFile={(f)=>{ setFile(f); setPreview(URL.createObjectURL(f)); }} accept="image/*" />
        </View>
      </View>
      {preview ? <Image source={{ uri: preview }} style={{ width:96, height:96, borderRadius:8, borderWidth:1, borderColor:C.border, marginTop:6 }} /> : null}
      <L>Description</L>
      <Input value={description} onChangeText={setDescription} placeholder="Aromatic rice with tender chicken…" multiline />
      <PrimaryButton title={saving?'Saving…':'Add dish'} onPress={()=>onCreate({ name:name.trim(), price:Number(price), description:description.trim(), file, preview })} disabled={!valid||saving} />
    </View>
  )
}

function DishEditor({ dish, onSave, onDelete }:{ dish:DishRow; onSave:(p:{id:number; name?:string; price?:number|string; description?:string; file?:File|null; preview?:string})=>void; onDelete:(id:number)=>void }){
  const [name,setName]=useState(dish.name||'')
  const [price,setPrice]=useState(String(dish.price??''))
  const [description,setDescription]=useState(dish.description||'')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<string|null>(dish.image||dish.thumbnail||'')

  return (
    <View style={{ backgroundColor:C.card, borderColor:C.border, borderWidth:1, borderRadius:12, padding:12, gap:8 }}>
      <View style={{ flexDirection:'row', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <Image source={{ uri: preview || 'https://placehold.co/96x96?text=Dish' }} style={{ width:96, height:96, borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:'#EEE' }} />
        <View style={{ flex:1, minWidth:200 }}>
          <L>Name</L>
          <Input value={name} onChangeText={setName} placeholder="Dish name" />
        </View>
        <View style={{ width:120 }}>
          <L>Price</L>
          <Input value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />
        </View>
        <View style={{ minWidth:220, alignItems:'flex-start' }}>
          <L>Replace photo</L>
          <FilePicker label="Choose image" onFile={(f)=>{ setFile(f); setPreview(URL.createObjectURL(f)); }} accept="image/*" />
        </View>
      </View>
      <L>Description</L>
      <Input value={description} onChangeText={setDescription} placeholder="Describe the dish" multiline />
      <View style={{ flexDirection:'row', gap:12 }}>
        <PrimaryButton title="Save" onPress={() => onSave({ id:dish.id, name:name.trim(), price:price, description:description.trim(), file, preview })} />
        <TouchableOpacity onPress={()=>onDelete(dish.id)} style={{ backgroundColor:'#7a1d1d', padding:12, borderRadius:10 }}>
          <Text style={{ color:'#fff', fontWeight:'900' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
