// Upload các tile SVG catalog lên Supabase Storage (bucket vdigital-media).
// Key lấy từ biến môi trường — chạy qua scripts/upload-with-key.py để
// key không bao giờ hiện trên log. Ghi manifest URL vào
// catalog-images/manifest-uploaded.json.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const imgDir = path.join(root, "catalog-images");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env.");
  process.exit(1);
}
const sb = createClient(url, key);
const manifest = JSON.parse(fs.readFileSync(path.join(imgDir, "manifest-svg.json"), "utf8"));
const uploaded = { products: {}, banners: {} };

async function up(localFile, remotePath) {
  const bytes = fs.readFileSync(path.join(imgDir, localFile));
  const { error } = await sb.storage.from("vdigital-media").upload(remotePath, bytes, {
    contentType: "image/svg+xml",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(`${remotePath}: ${error.message}`);
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/vdigital-media/${remotePath}`;
}

for (const [name, rel] of Object.entries(manifest.products)) {
  const file = path.basename(rel);
  uploaded.products[name] = await up(file, `products/${file}`);
  process.stdout.write(`.`);
}
process.stdout.write("\n");
for (const [file, rel] of Object.entries(manifest.banners)) {
  const local = path.basename(rel);
  uploaded.banners[file] = await up(local, `banners/${local}`);
}
fs.writeFileSync(path.join(imgDir, "manifest-uploaded.json"), JSON.stringify(uploaded, null, 2));
console.log(`uploaded products: ${Object.keys(uploaded.products).length}, banners: ${Object.keys(uploaded.banners).length}`);
