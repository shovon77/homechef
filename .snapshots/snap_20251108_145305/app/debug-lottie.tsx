import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";

const TEST_JSON_URL =
  "https://hjdbfodukvkqkvmwhafc.supabase.co/storage/v1/object/public/public-assets/homechef_banner_neutral.json"; // small, public, vector-only animation

export default function DebugLottie() {
  const id = "debug-lottie-container";
  const started = useRef(false);

  useEffect(() => {
    let anim: any;
    (async () => {
      try {
        // fetch a known-good lottie
        const r = await fetch(TEST_JSON_URL, { cache: "no-store" });
        console.log("[Debug] fetch status =", r.status);
        const data = await r.json();

        // mount with lottie-web (canvas)
        const lottie = (await import("lottie-web")).default;
        const el = document.getElementById(id)!;
        anim = lottie.loadAnimation({
          container: el,
          renderer: "canvas",
          loop: true,
          autoplay: true,
          animationData: data,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", clearCanvas: true },
        });
        console.log("[Debug] lottie-web started (canvas)");
      } catch (e) {
        console.log("[Debug] error:", e);
      }
    })();

    return () => {
      try { anim?.destroy?.(); } catch {}
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ marginBottom: 12, fontSize: 18, fontWeight: "700" }}>
        Lottie Web Debug
      </Text>
      {/* @ts-ignore raw div for lottie mount */}
      <div id={id} style={{
        width: "100%", maxWidth: 800, height: 320,
        display: "block", background: "#eef2f7", border: "1px dashed #94a3b8", borderRadius: 12
      }} />
      <Text style={{ marginTop: 12, color: "#64748b" }}>
        If you don't see an animation above but the console shows "lottie-web started", something is blocking canvas/SVG paint.
      </Text>
    </View>
  );
}
