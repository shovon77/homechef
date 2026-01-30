import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

const getCartStorageKey = (userId: string | null): string => {
  if (userId) {
    return `@homechef_cart_${userId}`;
  }
  // For anonymous users, use a session-based key that gets cleared on logout
  return '@homechef_cart_anonymous';
};

export type CartItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  chef_id?: number | null; // Store chef_id for single-chef constraint
  notes?: string;
};

type CartContextType = {
  items: CartItem[];
  cartChefId: number | null; // Current chef ID for the cart (single-chef constraint)
  addToCart: (item: CartItem) => { success: boolean; error?: string };
  removeFromCart: (id: string | number) => void;
  clearCart: () => void;
  setQuantity: (id: string | number, qty: number) => void;
  setNotes: (id: string | number, notes?: string) => void;
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Load cart for a specific user
  const loadCartForUser = async (userId: string | null) => {
    try {
      const storageKey = getCartStorageKey(userId);
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch (e) {
      console.warn('Failed to load cart for user', userId, e);
      setItems([]);
    }
  };

  // Initial load on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        userIdRef.current = userId;
        setCurrentUserId(userId);
        await loadCartForUser(userId);
      } catch (e) {
        console.warn('Failed to get initial session', e);
        await loadCartForUser(null);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Listen to auth state changes to detect login/logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const userId = session?.user?.id || null;
      const previousUserId = userIdRef.current;
      
      // If user changed (login or logout), switch carts
      if (userId !== previousUserId) {
        userIdRef.current = userId;
        setCurrentUserId(userId);
        
        // Clear current cart items before loading new user's cart
        setItems([]);
        
        // Load new user's cart
        await loadCartForUser(userId);
        
        // If user logged out, also clear anonymous cart storage
        if (!userId && previousUserId) {
          try {
            await AsyncStorage.removeItem(getCartStorageKey(null));
          } catch (e) {
            console.warn('Failed to clear anonymous cart', e);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Save cart to storage whenever it changes or user changes
  useEffect(() => {
    if (isLoaded && currentUserId !== null) {
      (async () => {
        try {
          const storageKey = getCartStorageKey(currentUserId);
          await AsyncStorage.setItem(storageKey, JSON.stringify(items));
        } catch (e) {
          console.warn('Failed to save cart to storage', e);
        }
      })();
    } else if (isLoaded && currentUserId === null) {
      // Save anonymous cart
      (async () => {
        try {
          const storageKey = getCartStorageKey(null);
          await AsyncStorage.setItem(storageKey, JSON.stringify(items));
        } catch (e) {
          console.warn('Failed to save anonymous cart to storage', e);
        }
      })();
    }
  }, [items, isLoaded, currentUserId]);
  
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
          p.id === item.id ? { 
            ...p, 
            quantity: p.quantity + (item.quantity || 1),
            notes: item.notes !== undefined ? item.notes : p.notes // Update notes if provided
          } : p
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    return { success: true };
  };

  const removeFromCart = (id: string | number) => {
    setItems(prev => prev.filter(p => p.id !== id));
  };

  const clearCart = async () => {
    setItems([]);
    try {
      const storageKey = getCartStorageKey(currentUserId);
      await AsyncStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear cart from storage', e);
    }
  };

  const setQuantity = (id: string | number, qty: number) => {
    setItems(prev =>
      qty <= 0 ? prev.filter(p => p.id !== id) : prev.map(p => (p.id === id ? { ...p, quantity: qty } : p))
    );
  };

  const setNotes = (id: string | number, notes?: string) => {
    const nextNotes = notes?.trim() ? notes.trim() : undefined;
    setItems(prev => prev.map(p => (p.id === id ? { ...p, notes: nextNotes } : p)));
  };

  const getQty = (id: string | number) => items.find(p => p.id === id)?.quantity ?? 0;

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  // Legacy aliases
  const add = addToCart;
  const remove = removeFromCart;
  const clear = clearCart;

  return (
    <CartContext.Provider
      value={{ items, cartChefId, addToCart, removeFromCart, clearCart, setQuantity, setNotes, total, getQty, add, remove, clear }}
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
