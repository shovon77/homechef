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
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export type TCreateCheckoutBody = z.infer<typeof CreateCheckoutBody>;

