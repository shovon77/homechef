import { supabase } from './supabase';

/**
 * Uploads an avatar image to Supabase Storage
 * @param file - File or Blob to upload
 * @param userId - User ID for the file path
 * @returns Public URL of the uploaded file
 */
export async function uploadAvatar(file: File | Blob, userId: string): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${userId}/${timestamp}.jpg`;
  const filePath = `avatars/${fileName}`;

  // Upload file to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: 'image/jpeg',
      upsert: true, // Replace if exists
    });

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  // Get public URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded avatar');
  }

  return data.publicUrl;
}

