import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { Alert } from "react-native";

export type CartItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  chef_id?: number | null; // Store chef_id for single-chef constraint
};

type CartContextType = {
  items: CartItem[];
  cartChefId: number | null; // Current chef ID for the cart (single-chef constraint)
  addToCart: (item: CartItem) => { success: boolean; error?: string };
  removeFromCart: (id: string | number) => void;
  clearCart: () => void;
  setQuantity: (id: string | number, qty: number) => void;
  total: number;
  getQty: (id: string | number) => number;

  // Legacy aliases (to avoid breaking older calls):
  add?: (item: CartItem) => { success: boolean; error?: string };
  remove?: (id: string | number) => void;
  clear?: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  
  // Derive cartChefId from first item's chef_id (single-chef constraint)
  const cartChefId = useMemo(() => {
    const firstItem = items[0];
    return firstItem?.chef_id ?? null;
  }, [items]);

  // Single-chef constraint: block adding dishes from different chefs
  const addToCart = (item: CartItem): { success: boolean; error?: string } => {
    // If cart is empty, allow adding and set chef_id
    if (items.length === 0) {
      setItems([{ ...item, quantity: item.quantity || 1 }]);
      return { success: true };
    }

    // Get current chef_id from first item
    const currentChefId = items[0]?.chef_id ?? null;
    const itemChefId = item.chef_id ?? null;

    // If chef_id doesn't match, block the addition
    if (currentChefId !== null && itemChefId !== null && currentChefId !== itemChefId) {
      Alert.alert(
        "Single Chef Order",
        "You can only add dishes from one chef per order. Please clear your cart or complete your current order first."
      );
      return { success: false, error: "Different chef" };
    }

    // If chef_id matches (or both are null), allow adding
    setItems(prev => {
      const found = prev.find(p => p.id === item.id);
      if (found) {
        return prev.map(p =>
          p.id === item.id ? { ...p, quantity: p.quantity + (item.quantity || 1) } : p
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    return { success: true };
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
      value={{ items, cartChefId, addToCart, removeFromCart, clearCart, setQuantity, total, getQty, add, remove, clear }}
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
