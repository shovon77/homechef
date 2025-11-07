// lib/upload.ts
import { supabase } from './supabase'

function safeName(name: string, fallback: string) {
  const base = (name && name.trim()) ? name.trim() : `${fallback}_${Date.now()}`
  return base.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function guessType(name?: string, provided?: string) {
  if (provided) return provided
  if (!name) return 'application/octet-stream'
  const ext = name.toLowerCase().split('.').pop()
  if (!ext) return 'application/octet-stream'
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif'
  }
  return map[ext] || 'application/octet-stream'
}

/**
 * Normalize anything (File, Blob, or RN-style { uri, type, name }) to a Blob with contentType.
 */
async function normalizeToBlob(input: any): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  // Web/Node File or Blob
  if (typeof File !== 'undefined' && input instanceof File) {
    return { blob: input, fileName: safeName(input.name, 'upload'), contentType: input.type || guessType(input.name) }
  }
  if (input instanceof Blob) {
    return { blob: input, fileName: safeName('upload.bin', 'upload'), contentType: input.type || 'application/octet-stream' }
  }

  // RN-style object: { uri, name?, type? }
  if (input?.uri) {
    const fileName = safeName(input.name || 'upload', 'upload')
    const contentType = guessType(fileName, input.type)
    // fetch the URI into a blob (Expo supports this)
    const resp = await fetch(input.uri)
    const blob = await resp.blob()
    return { blob, fileName, contentType }
  }

  throw new Error('Unsupported file input for upload')
}

export async function uploadToBucket(
  bucket: 'public-assets' | 'dish-images',
  file: any,                 // File | Blob | { uri, name?, type? }
  pathPrefix: string         // e.g. chefs/123/avatar or chefs/123/dishes/456
): Promise<{ publicUrl: string; path: string }> {
  const { blob, fileName, contentType } = await normalizeToBlob(file)
  const path = `${pathPrefix}/${fileName}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      upsert: true,
      cacheControl: '3600',
      contentType,
    })

  if (error) throw new Error(`[upload] bucket=${bucket} path=${path} :: ${error.message}`)

  const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(data.path)
  // @ts-ignore
  return { publicUrl: pub.publicUrl as string, path: data.path }
}
