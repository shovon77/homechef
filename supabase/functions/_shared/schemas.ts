// supabase/functions/_shared/schemas.ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const LineItemSchema = z.object({
  dish_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
});

export const CreateCheckoutBody = z.object({
  items: z.array(LineItemSchema).min(1),
  chef_id: z.number().int().positive(),
  // ISO datetime string required
  pickup_at: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "pickup_at must be ISO datetime"),
  // Allow URLs with placeholders like {ORDER_ID} - validate as URL pattern instead of strict URL
  success_url: z.string().refine(
    (s) => {
      // Replace placeholders with dummy values for validation, then check if it's a valid URL pattern
      const testUrl = s.replace(/\{[^}]+\}/g, 'placeholder');
      try {
        new URL(testUrl);
        return true;
      } catch {
        return false;
      }
    },
    "success_url must be a valid URL (placeholders like {ORDER_ID} are allowed)"
  ),
  cancel_url: z.string().url(), // cancel_url doesn't have placeholders, so strict validation is fine
});

export type TCreateCheckoutBody = z.infer<typeof CreateCheckoutBody>;

