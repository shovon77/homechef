// components/FilePicker.tsx
'use client'
import React, { useRef, useEffect } from 'react'
import { Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native'

const PRIMARY_COLOR = '#295141'; // Talo green from design

type Props = {
  label?: string
  accept?: string
  onFile: (file: File) => void
}

export default function FilePicker({ label = 'Choose image', accept = 'image/*', onFile }: Props) {
  if (Platform.OS === 'web') {
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    useEffect(() => {
      if (buttonRef.current && inputRef.current) {
        const handleClick = () => {
          inputRef.current?.click();
        };
        buttonRef.current.addEventListener('click', handleClick);
        return () => {
          buttonRef.current?.removeEventListener('click', handleClick);
        };
      }
    }, []);
    
    return (
      <View>
        {React.createElement('input', {
          ref: inputRef,
          type: 'file',
          accept: accept,
          style: { display: 'none' },
          onChange: async (e: any) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          },
        })}
        {React.createElement('button', {
          ref: buttonRef,
          type: 'button',
          style: {
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: 8,
            backgroundColor: PRIMARY_COLOR + '1A', // 10% opacity
            color: PRIMARY_COLOR,
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'background-color 0.2s',
          } as any,
          onMouseEnter: (e: any) => {
            e.currentTarget.style.backgroundColor = PRIMARY_COLOR + '33'; // 20% opacity on hover
          },
          onMouseLeave: (e: any) => {
            e.currentTarget.style.backgroundColor = PRIMARY_COLOR + '1A'; // Back to 10%
          },
        }, label)}
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
    <TouchableOpacity 
      onPress={pickNative} 
      style={styles.nativeButton}
    >
      <Text style={styles.nativeButtonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  nativeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR + '1A', // 10% opacity
    alignSelf: 'flex-start',
  },
  nativeButtonText: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
    fontSize: 14,
  },
})
