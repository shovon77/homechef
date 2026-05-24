// supabase/functions/_shared/schemas.ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const LineItemSchema = z.object({
  dish_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(500).optional(),
});

const urlWithPlaceholders = z.string().refine(
  (s) => {
    const testUrl = s.replace(/\{[^}]+\}/g, 'placeholder');
    try {
      new URL(testUrl);
      return true;
    } catch {
      return false;
    }
  },
  "success_url must be a valid URL (placeholders like {ORDER_ID} are allowed)",
);

export const CreateCheckoutBody = z
  .object({
    items: z.array(LineItemSchema).min(1),
    chef_id: z.number().int().positive(),
    fulfillment_method: z.enum(["pickup", "delivery"]),
    pickup_at: z.string().optional(),
    delivery_address: z.string().max(500).optional(),
    delivery_phone: z.string().max(30).optional(),
    delivery_at: z.string().optional(),
    success_url: urlWithPlaceholders,
    cancel_url: z.string().url(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment_method === "pickup") {
      if (!data.pickup_at || Number.isNaN(Date.parse(data.pickup_at))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pickup_at"],
          message: "pickup_at must be ISO datetime",
        });
      }
    } else {
      const addr = (data.delivery_address ?? "").trim();
      const phone = (data.delivery_phone ?? "").trim();
      if (!addr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delivery_address"],
          message: "delivery_address is required",
        });
      }
      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delivery_phone"],
          message: "delivery_phone is required",
        });
      }
      if (!data.delivery_at || Number.isNaN(Date.parse(data.delivery_at))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delivery_at"],
          message: "delivery_at must be ISO datetime",
        });
      }
    }
  });

export type TCreateCheckoutBody = z.infer<typeof CreateCheckoutBody>;
