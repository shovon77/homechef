'use client';
import { Slot } from 'expo-router';

/**
 * Public layout for /chef/* routes.
 * No auth gates here—detail pages handle their own data fetching.
 */
export default function ChefLayout() {
  return <Slot />;
}
