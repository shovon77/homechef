import { supabase } from './supabase';
import type { OrderStatus } from './types';

export async function updateOrderStatus(id: number, status: OrderStatus) {
  return await supabase.from('orders').update({ status }).eq('id', id);
}
