// components/FilePicker.tsx
'use client'
import React from 'react'
import { Platform, Text, TouchableOpacity, View } from 'react-native'

type Props = {
  label?: string
  accept?: string
  onFile: (file: File) => void
}

export default function FilePicker({ label = 'Choose image', accept = 'image/*', onFile }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View>
        <label style={{ display: 'inline-block' }}>
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          <span
            style={{
              cursor: 'pointer',
              padding: 10,
              borderRadius: 10,
              background: '#FBBF24',
              color: '#0B1F17',
              fontWeight: 800,
            }}
          >
            {label}
          </span>
        </label>
      </View>
    )
  }

  // Native (Expo) fallback using expo-document-picker if available
  const pickNative = async () => {
    try {
      // lazy import so web bundle doesn't include it
      const DocumentPicker = require('expo-document-picker')
      const res = await DocumentPicker.getDocumentAsync({
        type: accept,
        multiple: false,
        copyToCacheDirectory: true,
      })
      if (res.type === 'success') {
        // Build a File from the native asset (web-compatible)
        // @ts-ignore
        const file: File = {
          name: res.name || `upload_${Date.now()}`,
          // @ts-ignore
          type: res.mimeType || 'application/octet-stream',
          // @ts-ignore
          uri: res.uri,
        }
        // @ts-ignore
        onFile(file)
      }
    } catch (e) {
      console.warn('FilePicker error', e)
    }
  }

  return (
    <TouchableOpacity onPress={pickNative} style={{ padding: 10, borderRadius: 10, backgroundColor: '#FBBF24' }}>
      <Text style={{ color: '#0B1F17', fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  )
}
