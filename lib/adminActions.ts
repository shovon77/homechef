import { supabase } from './supabase';
import { Alert } from 'react-native';
import { isAdmin as checkIsAdmin } from './db';
import { isLocalAdmin } from './admin';

/**
 * Centralized admin actions with client-side guards
 * 
 * Note: These actions should be protected by RLS policies on the server side.
 * The client-side checks here are for UX only and should not be relied upon for security.
 */

/**
 * Check if current user is admin before performing action
 * Shows toast/alert if not admin
 * Uses db.isAdmin() and isLocalAdmin() for checks
 */
async function requireAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    Alert.alert('Admin only', 'You must be signed in to perform this action.');
    return false;
  }

  // Check profile.is_admin using db helper
  const isAdminFromProfile = await checkIsAdmin(user.id);

  // Check email allow-list
  const isAdminFromEmail = isLocalAdmin(user);

  if (!isAdminFromProfile && !isAdminFromEmail) {
    Alert.alert('Admin only', 'This action requires admin privileges.');
    return false;
  }

  return true;
}

/**
 * Toggle chef active status
 * Sets status to 'active' when activating, 'pending' when deactivating
 */
export async function toggleChefActive(chefId: number, active: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    // Use status field: 'active' when active=true, 'pending' when active=false
    const { error } = await supabase
      .from('chefs')
      .update({ status: active ? 'active' : 'pending' })
      .eq('id', chefId);

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: number, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Update user profile (e.g., approve, set role)
 */
export async function updateUserProfile(
  userId: string,
  updates: { is_chef?: boolean; is_admin?: boolean; [key: string]: any }
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Approve a chef application
 * Updates application status, sets user as chef, and creates/updates chefs table entry
 */
export async function approveChefApplication(
  applicationId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) {
      return { ok: false, error: 'Admin user not found' };
    }

    // Get the application
    const { data: application, error: fetchError } = await supabase
      .from('chef_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError) throw fetchError;
    if (!application) {
      return { ok: false, error: 'Application not found' };
    }

    // Update application status
    const { error: updateAppError } = await supabase
      .from('chef_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', applicationId);

    if (updateAppError) throw updateAppError;

    // Set user as chef in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_chef: true, role: 'chef' })
      .eq('id', application.user_id);

    if (profileError) throw profileError;

    // Create or update chefs table entry
    const { error: chefError } = await supabase
      .from('chefs')
      .upsert({
        name: application.name,
        email: application.email,
        phone: application.phone,
        location: application.location,
        bio: application.short_bio,
        status: 'active',
      }, {
        onConflict: 'name',
      });

    if (chefError) {
      // If chef already exists, just update it
      const { error: updateChefError } = await supabase
        .from('chefs')
        .update({
          email: application.email,
          phone: application.phone,
          location: application.location,
          bio: application.short_bio,
          status: 'active',
        })
        .eq('name', application.name);

      if (updateChefError) throw updateChefError;
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Reject a chef application
 */
export async function rejectChefApplication(
  applicationId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) {
      return { ok: false, error: 'Admin user not found' };
    }

    const { error } = await supabase
      .from('chef_applications')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', applicationId);

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

