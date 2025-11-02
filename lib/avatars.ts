/**
 * Deterministic avatar URL for a given chef name.
 * Uses DiceBear (no account needed). Same name => same avatar.
 */
const styles = ["adventurer","adventurer-neutral","avataaars","bottts","croodles","micah","identicon"] as const;

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = (h ^ str.charCodeAt(i)) * 16777619;
  return Math.abs(h >>> 0);
}

export function getChefAvatar(name: string, size = 128) {
  const seed = encodeURIComponent(name || "Chef");
  const h = hash(name || "Chef");
  const style = styles[h % styles.length];
  // Pick a color set deterministically
  const palettes = ["emerald","orange","blue","rose","violet","amber","teal","cyan"];
  const palette = palettes[h % palettes.length];
  // Randomize some face/feature choices, deterministically
  const radius = 40 + (h % 40); // 40–79
  return `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=${size}&backgroundType=gradientLinear&backgroundRotation=${h%360}&backgroundColor=${palette}&radius=${radius}`;
}
