import React, { createContext, useContext, useMemo, useState } from "react";

export type CartItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string | number) => void;
  clearCart: () => void;
  setQuantity: (id: string | number, qty: number) => void;
  total: number;
  getQty: (id: string | number) => number;

  // Legacy aliases (to avoid breaking older calls):
  add?: (item: CartItem) => void;
  remove?: (id: string | number) => void;
  clear?: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setItems(prev => {
      const found = prev.find(p => p.id === item.id);
      if (found) {
        return prev.map(p =>
          p.id === item.id ? { ...p, quantity: p.quantity + (item.quantity || 1) } : p
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeFromCart = (id: string | number) => {
    setItems(prev => prev.filter(p => p.id !== id));
  };

  const clearCart = () => setItems([]);

  const setQuantity = (id: string | number, qty: number) => {
    setItems(prev =>
      qty <= 0 ? prev.filter(p => p.id !== id) : prev.map(p => (p.id === id ? { ...p, quantity: qty } : p))
    );
  };

  const getQty = (id: string | number) => items.find(p => p.id === id)?.quantity ?? 0;

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  // Legacy aliases
  const add = addToCart;
  const remove = removeFromCart;
  const clear = clearCart;

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, clearCart, setQuantity, total, getQty, add, remove, clear }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
