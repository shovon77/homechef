import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { getChefByIdOrSlug } from "../../../lib/db";
import { submitChefReview } from "../../../lib/reviews";
import { theme } from "../../../constants/theme";
import Stars from "../../components/Stars";

type Chef = { id: number; name: string; slug?: string | null; rating?: number | null; rating_count?: number | null; };
type Review = { id: number; chef_id: number; user_name: string | null; rating: number; comment: string | null; created_at: string; };

export default function ChefReviewsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugOrId = Array.isArray(slug) ? slug[0] : slug ?? "";
  const [chef, setChef] = useState<Chef | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [userName, setUserName] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const avg = useMemo(() => {
    if (!reviews.length) return chef?.rating ?? 0;
    const s = reviews.reduce((a, r) => a + (r.rating || 0), 0);
    return s / reviews.length;
  }, [reviews, chef?.rating]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!slugOrId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const chefData = await getChefByIdOrSlug(slugOrId);
      if (!mounted) return;
      if (!chefData) {
        setChef(null);
        setLoading(false);
        return;
      }
      setChef(chefData as Chef);
      const chefId = chefData.id;
      const { data: revData } = await supabase
        .from("chef_reviews")
        .select("*")
        .eq("chef_id", chefId)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      setReviews((revData as any) || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [slugOrId]);

  const submit = async () => {
    if (!chef || !stars || stars < 1 || stars > 5) return Alert.alert("Rating required", "Please select 1–5 stars.");
    const chefId = chef.id;
    try {
      setSaving(true);
      await submitChefReview({
        chefId,
        rating: stars,
        comment: comment.trim() || undefined,
      });

      const [chefData, { data: revData, error: rErr }] = await Promise.all([
        getChefByIdOrSlug(slugOrId),
        supabase
          .from("chef_reviews")
          .select("*")
          .eq("chef_id", chefId)
          .order("created_at", { ascending: false }),
      ]);
      if (rErr) {
        Alert.alert("Error", rErr.message);
        return;
      }
      if (chefData) setChef(chefData as Chef);
      setReviews((revData as any) || []);

      setUserName("");
      setStars(5);
      setComment("");
      Alert.alert("Thanks!", "Your review was submitted.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to submit review.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!chef) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.colors.white }}>Chef not found.</Text>
      </View>
    );
  }

  const chefPath = `/chef/${chef.slug ?? chef.id}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ maxWidth: 900, width: "100%", alignSelf: "center", padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: "900" }}>
            Reviews for {chef.name}
          </Text>
          <Link href={chefPath} asChild>
            <TouchableOpacity style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>Back to chef</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#cbd5e1", marginBottom: 6 }}>Average rating</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Stars value={avg || 0} size={22} />
            <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>
              {avg ? avg.toFixed(1) : "—"} {reviews.length ? `(${reviews.length})` : ""}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 10 }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900" }}>Leave a review</Text>
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#cbd5e1" }}>Your name (optional)</Text>
            <TextInput
              placeholder="e.g., Sara"
              placeholderTextColor="#94a3b8"
              value={userName}
              onChangeText={setUserName}
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 10, borderRadius: 10 }}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#cbd5e1" }}>Rating</Text>
            <Stars value={stars} onChange={setStars} size={28} color="#fbbf24" />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#cbd5e1" }}>Comment</Text>
            <TextInput
              placeholder="Share your experience…"
              placeholderTextColor="#94a3b8"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 10, borderRadius: 10, minHeight: 80 }}
            />
          </View>
          <TouchableOpacity
            onPress={submit}
            disabled={saving}
            style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10, opacity: saving ? 0.7 : 1 }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "900", textAlign: "center" }}>
              {saving ? "Submitting…" : "Submit review"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 10 }}>
          {reviews.length === 0 ? (
            <Text style={{ color: "#94a3b8" }}>No reviews yet.</Text>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.colors.white, fontWeight: "800" }}>
                    {r.user_name || "Anonymous"}
                  </Text>
                  <Stars value={r.rating} />
                </View>
                {!!r.comment && <Text style={{ color: "#cbd5e1", marginTop: 6 }}>{r.comment}</Text>}
                <Text style={{ color: "#94a3b8", marginTop: 6, fontSize: 12 }}>
                  {new Date(r.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
