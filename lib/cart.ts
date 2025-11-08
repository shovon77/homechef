type CartItem = { id: number; name?: string | null; price?: number | null; image?: string | null; qty: number; };
const KEY = 'homechef_cart';
function read(): CartItem[] { try { if (typeof window === 'undefined') return []; const r = window.localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function write(items: CartItem[]) { try { if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }
export const cart = {
  get() { return read(); },
  add(item: Omit<CartItem, 'qty'> & { qty?: number }) { const items = read(); const i = items.findIndex(x => x.id === item.id); if (i >= 0) { items[i].qty += item.qty ?? 1; } else { items.push({ ...item, qty: item.qty ?? 1 }); } write(items); return items; },
  remove(id: number) { const items = read().filter(i => i.id !== id); write(items); return items; },
  clear() { write([]); },
  setQty(id: number, qty: number) { const items = read(); const idx = items.findIndex(i => i.id === id); if (idx >= 0) { if (qty <= 0) { items.splice(idx, 1); } else { items[idx].qty = qty; } } write(items); return items; },
};

