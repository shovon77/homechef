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
 */
export async function toggleChefActive(chefId: number, active: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Admin access required' };
  }

  try {
    const { error } = await supabase
      .from('chefs')
      .update({ active })
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

