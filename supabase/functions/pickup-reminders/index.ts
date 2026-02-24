import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';

serve(async (_req) => {
  try {
    const now = new Date();
    const ms = (h: number, m: number) => (h * 60 + m) * 60 * 1000;

    // Windows: ~3h, ~2h, ~1h before pickup (20-min windows for 15-min cron)
    const chef3hStart = new Date(now.getTime() + ms(2, 50));
    const chef3hEnd = new Date(now.getTime() + ms(3, 10));
    const chef1hStart = new Date(now.getTime() + ms(0, 50));
    const chef1hEnd = new Date(now.getTime() + ms(1, 10));
    const u2hStart = new Date(now.getTime() + ms(1, 50));
    const u2hEnd = new Date(now.getTime() + ms(2, 10));
    const u1hStart = new Date(now.getTime() + ms(0, 50));
    const u1hEnd = new Date(now.getTime() + ms(1, 10));

    let chef3hCount = 0;
    let chef1hCount = 0;
    let user2hCount = 0;
    let user1hCount = 0;

    async function fetchOrdersInWindow(start: Date, end: Date) {
      const { data, error } = await adminClient
        .from('orders')
        .select('id, user_id, chef_id, pickup_at')
        .in('status', ['pending', 'preparing', 'ready'])
        .not('pickup_at', 'is', null)
        .gte('pickup_at', start.toISOString())
        .lte('pickup_at', end.toISOString());
      if (error) return [] as any[];
      return data || [];
    }

    const [chef3hOrders, chef1hOrders, user2hOrders, user1hOrders] = await Promise.all([
      fetchOrdersInWindow(chef3hStart, chef3hEnd),
      fetchOrdersInWindow(chef1hStart, chef1hEnd),
      fetchOrdersInWindow(u2hStart, u2hEnd),
      fetchOrdersInWindow(u1hStart, u1hEnd),
    ]);

    const allOrderIds = [...new Set([
      ...chef3hOrders.map((o: any) => o.id),
      ...chef1hOrders.map((o: any) => o.id),
      ...user2hOrders.map((o: any) => o.id),
      ...user1hOrders.map((o: any) => o.id),
    ])];
    if (allOrderIds.length === 0) {
      return new Response(
        JSON.stringify({ chef3h: 0, chef1h: 0, user2h: 0, user1h: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const orders = [...chef3hOrders, ...chef1hOrders, ...user2hOrders, ...user1hOrders];

    // Fetch chefs to get user_id
    const chefIds = [...new Set(orders.map((o: any) => o.chef_id).filter(Boolean))];
    const { data: chefs } = await adminClient
      .from('chefs')
      .select('id, user_id')
      .in('id', chefIds);
    const chefUserMap = new Map<number, string>();
    (chefs || []).forEach((c: any) => {
      if (c.user_id) chefUserMap.set(c.id, c.user_id);
    });

    // Helper: check if we already sent this reminder
    async function alreadySent(type: string, orderId: number, userId: string): Promise<boolean> {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await adminClient
        .from('notifications')
        .select('id')
        .eq('type', type)
        .eq('related_id', orderId)
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo)
        .limit(1);
      return (existing?.length ?? 0) > 0;
    }

    const chef3hOrderIds = new Set(chef3hOrders.map((o: any) => o.id));
    const chef1hOrderIds = new Set(chef1hOrders.map((o: any) => o.id));
    const user2hOrderIds = new Set(user2hOrders.map((o: any) => o.id));
    const user1hOrderIds = new Set(user1hOrders.map((o: any) => o.id));

    for (const order of orders) {
      // Chef reminder: ~3h before
      if (chef3hOrderIds.has(order.id)) {
        const chefUserId = order.chef_id ? chefUserMap.get(order.chef_id) : null;
        if (chefUserId && !(await alreadySent('chef_pickup_reminder', order.id, chefUserId))) {
          const { error: notifErr } = await adminClient.rpc('create_notification_for_user', {
            p_user_id: chefUserId,
            p_type: 'chef_pickup_reminder',
            p_title: 'Pickup scheduled for today',
            p_message: 'Pickup scheduled for today',
            p_related_id: order.id,
            p_related_type: 'order',
          });
          if (!notifErr) chef3hCount++;
          else console.warn('[pickup-reminders] chef 3h notif error', order.id, notifErr);
        }
      }

      // Chef reminder: ~1h before
      if (chef1hOrderIds.has(order.id)) {
        const chefUserId = order.chef_id ? chefUserMap.get(order.chef_id) : null;
        if (chefUserId && !(await alreadySent('chef_pickup_reminder_1h', order.id, chefUserId))) {
          const { error: notifErr } = await adminClient.rpc('create_notification_for_user', {
            p_user_id: chefUserId,
            p_type: 'chef_pickup_reminder_1h',
            p_title: 'Pickup scheduled for today',
            p_message: 'Pickup scheduled for today',
            p_related_id: order.id,
            p_related_type: 'order',
          });
          if (!notifErr) chef1hCount++;
          else console.warn('[pickup-reminders] chef 1h notif error', order.id, notifErr);
        }
      }

      // User 2h reminder
      if (user2hOrderIds.has(order.id)) {
        const userId = order.user_id;
        if (userId && !(await alreadySent('user_pickup_reminder_2h', order.id, userId))) {
          const orderNum = String(order.id).padStart(5, '0');
          const { error: notifErr } = await adminClient.rpc('create_notification_for_user', {
            p_user_id: userId,
            p_type: 'user_pickup_reminder_2h',
            p_title: 'Pickup scheduled for today',
            p_message: `Pickup scheduled for today - Order #${orderNum}`,
            p_related_id: order.id,
            p_related_type: 'order',
          });
          if (!notifErr) user2hCount++;
          else console.warn('[pickup-reminders] user 2h notif error', order.id, notifErr);
        }
      }

      // User 1h reminder
      if (user1hOrderIds.has(order.id)) {
        const userId = order.user_id;
        if (userId && !(await alreadySent('user_pickup_reminder_1h', order.id, userId))) {
          const orderNum = String(order.id).padStart(5, '0');
          const { error: notifErr } = await adminClient.rpc('create_notification_for_user', {
            p_user_id: userId,
            p_type: 'user_pickup_reminder_1h',
            p_title: 'Pickup scheduled for today',
            p_message: `Pickup scheduled for today - Order #${orderNum}`,
            p_related_id: order.id,
            p_related_type: 'order',
          });
          if (!notifErr) user1hCount++;
          else console.warn('[pickup-reminders] user 1h notif error', order.id, notifErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ chef3h: chef3hCount, chef1h: chef1hCount, user2h: user2hCount, user1h: user1hCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[pickup-reminders] error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
