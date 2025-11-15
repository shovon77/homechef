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

  console.log('Uploading avatar to path:', filePath);

  // Upload file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: 'image/jpeg',
      upsert: true, // Replace if exists
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  console.log('Upload successful, getting public URL...');

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded avatar');
  }

  console.log('Public URL:', urlData.publicUrl);
  return urlData.publicUrl;
}

