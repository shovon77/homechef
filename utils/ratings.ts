import { supabase } from "../lib/supabase";

export async function getDishAvgRating(dishId: number): Promise<number> {
  const { data, error } = await supabase
    .from("dish_ratings")
    .select("stars, rating")
    .eq("dish_id", dishId);
  if (error || !data?.length) return 0;
  const vals = data.map(r => Number((r as any).stars ?? (r as any).rating) || 0);
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
}

export async function getChefAvgRating(chefId: number): Promise<number> {
  const { data, error } = await supabase
    .from("chef_ratings")
    .select("stars")
    .eq("chef_id", chefId);
  if (error || !data?.length) return 0;
  const vals = data.map(r => Number((r as any).stars) || 0);
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
}
