// Render ảnh sản phẩm + banner dạng SVG (không dùng AI generate — tool
// generate ảnh từ chối mọi prompt chứa tên thương hiệu). Tile theo đúng
// phong cách fallback của ProductImage: nền gradient tối + chữ, không logo.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const outDir = path.join(root, "catalog-images");
fs.mkdirSync(outDir, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(root, "makhive-catalog.json"), "utf8"));

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrapLines(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function initials(name) {
  const words = String(name).split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "V") + (words[1]?.[0] ?? "");
}

function tileSVG({ title, subtitle, initials: init }) {
  const lines = wrapLines(title, 14);
  const lineH = 78;
  const totalH = lines.length * lineH;
  const startY = 470 - totalH / 2 + 30;
  const titleSvg = lines
    .map((l, i) => `<text x="400" y="${startY + i * lineH}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${esc(l)}</text>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.55" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#4c1d95"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.12" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.95" r="0.5">
      <stop offset="0" stop-color="#f59e0b" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#glow)"/>
  <rect width="800" height="800" fill="url(#glow2)"/>
  <circle cx="700" cy="120" r="90" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <circle cx="90" cy="690" r="70" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <rect x="330" y="150" width="140" height="140" rx="32" fill="#7c3aed"/>
  <text x="400" y="248" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="#ffffff">${esc(init.toUpperCase())}</text>
  ${titleSvg}
  <text x="400" y="${startY + lines.length * lineH + 52}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="600" letter-spacing="3" fill="#c4b5fd">${esc(subtitle.toUpperCase())}</text>
  <text x="400" y="740" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="8" fill="#ffffff" opacity="0.45">VDIGITAL</text>
</svg>`;
}

function bannerSVG({ big, sub }) {
  const lines = wrapLines(big, 16);
  const titleSvg = lines
    .map((l, i) => `<text x="70" y="${210 + i * 92}" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="800" fill="#ffffff">${esc(l)}</text>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="0.6" stop-color="#6d28d9"/>
      <stop offset="1" stop-color="#db2777"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.9" cy="0.1" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#bg)"/>
  <rect width="1200" height="600" fill="url(#glow)"/>
  <circle cx="1080" cy="90" r="110" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
  <circle cx="1010" cy="520" r="70" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
  <text x="70" y="110" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="6" fill="#ffffff" opacity="0.75">VDIGITAL — TÀI KHOẢN SỐ GIÁ TỐT</text>
  ${titleSvg}
  <text x="70" y="${210 + lines.length * 92 + 10}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="400" fill="#ffffff" opacity="0.9">${esc(sub)}</text>
</svg>`;
}

const manifest = { products: {}, banners: {} };
for (const p of catalog.products) {
  const slug = slugify(p.name);
  const file = `${slug}.svg`;
  fs.writeFileSync(
    path.join(outDir, file),
    tileSVG({ title: p.name, subtitle: p.category || "Tài khoản bản quyền", initials: initials(p.name) }),
  );
  manifest.products[p.name] = `catalog-images/${file}`;
}
// Thẻ game không có trong MaKHive — tile riêng cho 2 sản phẩm sẵn có của shop.
for (const g of [
  { name: "Thẻ Garena", category: "Thẻ game" },
  { name: "Thẻ Zing", category: "Thẻ game" },
]) {
  const file = `${slugify(g.name)}.svg`;
  fs.writeFileSync(path.join(outDir, file), tileSVG({ title: g.name, subtitle: g.category, initials: initials(g.name) }));
  manifest.products[g.name] = `catalog-images/${file}`;
}
const banners = [
  { file: "banner-flash-sale.svg", big: "FLASH SALE", sub: "Giảm sâu mỗi ngày — hết giờ là về giá gốc" },
  { file: "banner-new-products.svg", big: "Sản phẩm mới", sub: "Tài khoản bản quyền mới lên kệ mỗi tuần" },
  { file: "banner-topup-xu.svg", big: "Nạp Xu — Ví Xu", sub: "Nạp Xu bằng VietQR, thanh toán nhanh không cần quét mã mỗi lần" },
];
for (const b of banners) {
  fs.writeFileSync(path.join(outDir, b.file), bannerSVG(b));
  manifest.banners[b.file] = `catalog-images/${b.file}`;
}
fs.writeFileSync(path.join(outDir, "manifest-svg.json"), JSON.stringify(manifest, null, 2));
console.log(`products: ${Object.keys(manifest.products).length}, banners: ${Object.keys(manifest.banners).length}`);
