// fixUpload.js — re-adds Upload Photo button to app/dish/[id].tsx safely
const fs = require("fs");
const file = "app/dish/[id].tsx";

let code = fs.readFileSync(file, "utf8");

// ensure ImagePicker import
if (!code.includes("expo-image-picker")) {
  code = code.replace(
    /from "react-native";\n/,
    'from "react-native";\nimport * as ImagePicker from "expo-image-picker";\n'
  );
}

// inject Upload button if not already there
if (!code.includes("Upload photo")) {
  const uploadBtn = `
          <TouchableOpacity
            onPress={async () => {
              try {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (perm.status !== "granted") {
                  alert("Permission required to upload");
                  return;
                }
                const picked = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.9,
                });
                if (picked.canceled) return;
                const file = picked.assets[0];
                const uri = file.uri;
                const name =
                  uri.split("/").pop() || "dish-" + Date.now() + ".jpg";
                const path = \`dishes/\${dish.id}/\${name}\`;
                const res = await fetch(uri);
                const blob = await res.blob();
                const { error: upErr } = await supabase.storage
                  .from("dish-images")
                  .upload(path, blob, {
                    upsert: true,
                    contentType: file.mimeType || "image/jpeg",
                  });
                if (upErr) {
                  console.log("upload error", upErr);
                  alert(upErr.message);
                  return;
                }
                const { data: pub } = await supabase.storage
                  .from("dish-images")
                  .getPublicUrl(path);
                const publicUrl = pub?.publicUrl;
                if (publicUrl) {
                  const { error: upRow } = await supabase
                    .from("dishes")
                    .update({ image: publicUrl })
                    .eq("id", dish.id);
                  if (upRow) {
                    console.log("row update error", upRow);
                    alert(upRow.message);
                  } else {
                    alert("Photo updated!");
                  }
                }
              } catch (e) {
                console.log("upload exception", e);
                alert("Upload failed");
              }
            }}
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#e2e8f0", fontWeight: "700" }}>
              Upload photo
            </Text>
          </TouchableOpacity>`;
  // insert before the closing </View> of the dish card controls
  code = code.replace(/<\/View>\s*\);\s*}/, `${uploadBtn}\n        </View>\n      );\n}`);
}

fs.writeFileSync(file, code);
console.log("✅ Upload Photo button restored in", file);
