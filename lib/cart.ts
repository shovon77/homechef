type CartItem = {
  id: number;
  name?: string | null;
  price?: number | null;
  image?: string | null;
  qty: number;
};

const KEY = 'homechef_cart';

function read(): CartItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as CartItem[] : [];
  } catch { return []; }
}
function write(items: CartItem[]) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export const cart = {
  get(): CartItem[] { return read(); },
  add(item: Omit<CartItem,'qty'> & { qty?: number }) {
    const items = read();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      items[idx].qty += item.qty ?? 1;
    } else {
      items.push({ ...item, qty: item.qty ?? 1 });
    }
    write(items);
    return items;
  },
  remove(id: number) {
    const items = read().filter(i => i.id !== id);
    write(items);
    return items;
  },
  clear() { write([]); }
};
