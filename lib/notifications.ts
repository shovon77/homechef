// lib/notifications.ts
import { supabase } from './supabase';

// SMS is sent via database trigger (trigger_send_notification_sms) on notifications INSERT.
// No client-side invoke needed - more reliable.

export type NotificationType = 
  | 'welcome'
  | 'order_placed'
  | 'order_ready'
  | 'order_issue_updated'
  | 'order_message'
  | 'issue_reported'
  | 'chef_request'
  | 'chef_application_submitted'
  | 'chef_application_approved'
  | 'chef_application_rejected'
  | 'new_order_request'
  | 'new_user_signup'
  | 'review_reply';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_id?: number;
  related_type?: string;
  read: boolean;
  created_at: string;
}

/**
 * Create a notification for a user
 * Uses a database function to bypass RLS when creating notifications for other users
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number,
  relatedType?: string
): Promise<Notification | null> {
  try {
    // Check if we're creating a notification for the current user
    const { data: { user } } = await supabase.auth.getUser();
    const isForCurrentUser = user && user.id === userId;

    if (isForCurrentUser) {
      // If creating for self, use direct insert (faster and simpler)
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          related_id: relatedId,
          related_type: relatedType,
          read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      return data;
    } else {
      // If creating for another user, use the database function to bypass RLS
      const { data, error } = await supabase.rpc('create_notification_for_user', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_related_id: relatedId || null,
        p_related_type: relatedType || null,
      });

      if (error) {
        console.error('Error creating notification via function:', error);
        return null;
      }

      // The function returns the notification ID, so we need to fetch the full notification
      if (data) {
        const { data: notification, error: fetchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', data)
          .single();

        if (fetchError) {
          console.error('Error fetching created notification:', fetchError);
          return null;
        }

        return notification;
      }

      return null;
    }
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

/**
 * Create welcome notification for new users
 * Always uses direct insert since welcome notifications are always for the current user
 */
export async function createWelcomeNotification(userId: string): Promise<Notification | null> {
  try {
    // For welcome notifications, always use direct insert since they're for the current user
    // This avoids any timing issues with session establishment
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'welcome',
        title: 'Welcome to YourHomeChef!',
        message: 'Thank you for joining YourHomeChef. Start exploring delicious homemade meals from local chefs!',
        read: false,
      })
      .select()
      .single();

    if (error) {
      // If error is about duplicate or constraint violation, that's okay - notification already exists
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('already exists')) {
        console.log('Welcome notification already exists for user');
        return null;
      }
      console.error('Error creating welcome notification:', error);
      return null;
    }

    return data;
  } catch (err: any) {
    console.error('Error creating welcome notification:', err);
    return null;
  }
}

/**
 * Create order placed notification
 */
export async function createOrderPlacedNotification(
  userId: string,
  orderId: number
): Promise<Notification | null> {
  return createNotification(
    userId,
    'order_placed',
    'Order Placed',
    'Your order has been placed successfully. The chef will start preparing it soon.',
    orderId,
    'order'
  );
}

/**
 * Create order ready notification
 */
export async function createOrderReadyNotification(
  userId: string,
  orderId: number
): Promise<Notification | null> {
  return createNotification(
    userId,
    'order_ready',
    'Order Ready for Pickup',
    'Your order is ready for pickup! Please collect it from the chef.',
    orderId,
    'order'
  );
}

/**
 * Create order issue updated notification
 */
export async function createOrderIssueUpdatedNotification(
  userId: string,
  orderId: number
): Promise<Notification | null> {
  return createNotification(
    userId,
    'order_issue_updated',
    'Order Issue Updated',
    'There has been an update regarding an issue with your order.',
    orderId,
    'order'
  );
}

/**
 * Create new message in order notification
 */
export async function createOrderMessageNotification(
  userId: string,
  orderId: number
): Promise<Notification | null> {
  return createNotification(
    userId,
    'order_message',
    'New Message in Order',
    'You have a new message regarding your order.',
    orderId,
    'order'
  );
}

/**
 * Create issue reported notification (admin only)
 */
export async function createIssueReportedNotification(
  adminUserId: string,
  issueId: number
): Promise<Notification | null> {
  return createNotification(
    adminUserId,
    'issue_reported',
    'Issue Reported',
    'A new issue has been reported and requires your attention.',
    issueId,
    'issue'
  );
}

/**
 * Create new chef request notification (admin only)
 */
export async function createChefRequestNotification(
  adminUserId: string,
  applicationId: string
): Promise<Notification | null> {
  return createNotification(
    adminUserId,
    'chef_request',
    'New Chef Request',
    'A new chef application has been submitted and requires review.',
    undefined,
    'chef_application'
  );
}

/**
 * Create chef application submitted notification
 */
export async function createChefApplicationSubmittedNotification(
  userId: string
): Promise<Notification | null> {
  return createNotification(
    userId,
    'chef_application_submitted',
    'Chef Application Submitted',
    'Your chef application has been submitted successfully. We will review it and get back to you soon.'
  );
}

/**
 * Create chef application approved notification
 */
export async function createChefApplicationApprovedNotification(
  userId: string
): Promise<Notification | null> {
  return createNotification(
    userId,
    'chef_application_approved',
    'Chef Application Approved',
    'Congratulations! Your chef application has been approved. You can now start listing your dishes.'
  );
}

/**
 * Create chef application rejected notification
 */
export async function createChefApplicationRejectedNotification(
  userId: string,
  reason?: string
): Promise<Notification | null> {
  return createNotification(
    userId,
    'chef_application_rejected',
    'Chef Application Status',
    reason || 'Your chef application has been reviewed. Please contact support for more information.'
  );
}

/**
 * Create new order request notification (chef only)
 */
export async function createNewOrderRequestNotification(
  chefUserId: string,
  orderId: number
): Promise<Notification | null> {
  return createNotification(
    chefUserId,
    'new_order_request',
    'New Order Request',
    'You have received a new order request. Please review and respond.',
    orderId,
    'order'
  );
}
