// Kiểm tra nhanh các luồng chính của VDigital.
// Chạy: npm run dev (ở terminal khác) rồi: npm run test:flows
// Hoặc: BASE_URL=https://vdigital.vercel.app npm run test:flows
const BASE = process.env.BASE_URL || "http://localhost:3000";

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function main() {
  console.log(`VDigital flow tests — ${BASE}`);

  // 1. Trang chủ — sản phẩm phải có sẵn trong HTML đầu tiên (server render),
  //    không được để client "Đang tải sản phẩm…" 10–15s.
  let res = await fetch(`${BASE}/`);
  let html = await res.text();
  check("home renders (200 + VDigital)", res.ok && html.includes("VDigital"));
  check("home SSR: product names in initial HTML", html.includes("CapCut Pro") && html.includes("Canva Pro"), "CapCut/Canva missing from SSR HTML");
  check("home SSR: no loading placeholder", !html.includes("Đang tải sản phẩm"));
  // Thẻ game: mỗi hãng đúng 1 card trên trang chủ. Huy hiệu "Thẻ game · chọn
  // mệnh giá" chỉ có 1/card (tên sản phẩm thì xuất hiện nhiều lần trong HTML
  // vì cả ảnh fallback lẫn tiêu đề card đều có tên).
  const gameBadgesHome = html.split("Thẻ game · chọn mệnh giá").length - 1;
  check("home: exactly 2 game-card badges (Garena + Zing, 1 card each)", gameBadgesHome === 2, `got ${gameBadgesHome}`);
  check("home: both game brands present", html.includes("Thẻ Garena") && html.includes("Thẻ Zing"));

  // 2. Danh sách sản phẩm
  res = await fetch(`${BASE}/san-pham`);
  const listHtml = await res.text();
  check("list /san-pham renders", res.ok && listHtml.includes("sản phẩm"));
  const gameBadgesList = listHtml.split("Thẻ game · chọn mệnh giá").length - 1;
  check("list: exactly 2 game-card badges (Garena + Zing, 1 card each)", gameBadgesList === 2, `got ${gameBadgesList}`);

  // 3. Chi tiết sản phẩm (CapCut Pro) — pill selector "Chọn gói" + giá theo gói
  res = await fetch(`${BASE}/tai-khoan-ban-quyen/capcut-pro`);
  html = await res.text();
  check("detail CapCut Pro renders", res.ok && html.includes("CapCut"));
  check("detail: option pill group label", html.includes("Chọn gói"), "no 'Chọn gói' label in SSR HTML");
  // 3b. Chi tiết thẻ Garena — pill mệnh giá + các mệnh giá có trong HTML
  res = await fetch(`${BASE}/the-game/the-garena`);
  const gaHtml = await res.text();
  check("detail Garena renders with denomination pills", res.ok && gaHtml.includes("Chọn mệnh giá") && gaHtml.includes("20K") && gaHtml.includes("500K"), `got ${res.status}`);

  // 4. Catalog API
  res = await fetch(`${BASE}/api/catalog`);
  const catalog = await res.json();
  check("GET /api/catalog has products", res.ok && Array.isArray(catalog.products) && catalog.products.length >= 10, `got ${catalog.products?.length}`);
  const capcut = catalog.products.find((p) => p.slug === "capcut-pro");
  const variant30d = capcut?.variants.find((v) => v.label === "30 ngày");
  check("CapCut 30d variant price 55000", variant30d?.price === 55000, `got ${variant30d?.price}`);

  // 5. Tạo đơn demo (chế độ chưa có PayOS) — gói auto CapCut 30 ngày
  res = await fetch(`${BASE}/api/payos/create-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ variantId: "v-cc-30d", qty: 1 }],
      customer: { name: "Test User", email: "test@example.com", phone: "0900000000" },
    }),
  });
  const created = await res.json();
  check("create-payment demo returns orderCode", res.ok && typeof created.orderCode === "string", JSON.stringify(created).slice(0, 200));
  const orderCode = created.orderCode;

  // 6. Webhook từ chối body sai (demo mode: body rỗng -> 400)
  res = await fetch(`${BASE}/api/payos/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonsense: true }),
  });
  check("webhook rejects bad body (non-2xx)", !res.ok, `got ${res.status}`);

  // 7. Webhook demo giao hàng tự động
  if (orderCode) {
    res = await fetch(`${BASE}/api/payos/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true, orderCode }),
    });
    const hooked = await res.json();
    check("demo webhook fulfills order", res.ok && hooked.ok === true, JSON.stringify(hooked).slice(0, 200));

    // 8. Đơn đã giao có mã auto
    res = await fetch(`${BASE}/api/orders/${orderCode}`);
    const order = await res.json();
    const item = order.items?.[0];
    check(
      "order shows delivered auto code",
      res.ok && order.status === "completed" && item?.status === "delivered" && !!item?.delivered_code,
      JSON.stringify(order).slice(0, 300),
    );
  }

  // 9. Admin settings API: chẩn đoán env (không cần auth? cần admin -> 403 khi chưa đăng nhập)
  res = await fetch(`${BASE}/api/admin/settings`);
  check("admin settings API without auth returns 403", res.status === 403, `got ${res.status}`);

  // 10. Admin page renders (gate — SSR shows loading state, gate appears after hydration)
  res = await fetch(`${BASE}/admin`);
  const adminHtml = await res.text();
  check("admin page renders", res.ok && (adminHtml.includes("Quản trị") || adminHtml.includes("Đang kiểm tra quyền")), `got ${res.status}`);

  // 11. Admin API không có quyền -> 403
  res = await fetch(`${BASE}/api/admin/orders`);
  check("admin API without auth returns 403", res.status === 403, `got ${res.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e.message);
  process.exit(1);
});
