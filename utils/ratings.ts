import { supabase } from "../lib/supabase";
import { getDishRatings } from "../lib/db";

export async function getDishAvgRating(dishId: number): Promise<number> {
  const { average } = await getDishRatings(dishId);
  return average;
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
