// Kiểm tra nhanh các luồng chính của VDigital.
// Chạy: npm run dev (ở terminal khác) rồi: npm run test:flows
// Hoặc: BASE_URL=https://vdigital.vercel.app npm run test:flows
import { readFileSync } from "node:fs";

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

  // 1b. Thẻ sản phẩm: mỗi card có CẢ "Mua ngay" và "Thêm vào giỏ" (v3).
  const addCountHome = html.split("Thêm vào giỏ").length - 1;
  check("home: product cards have 'Thêm vào giỏ' button", addCountHome >= 5, `got ${addCountHome}`);
  const buyCountHome = html.split("Mua ngay").length - 1;
  check("home: product cards have 'Mua ngay' button", buyCountHome >= 5, `got ${buyCountHome}`);
  // Bottom nav mobile (5 mục) có trong HTML.
  check("home: mobile bottom nav present", html.includes("Giỏ hàng") && html.includes("Tài khoản"), "bottom nav labels missing");
  // Chuông thông báo (popup) có trong header; không còn chữ "tiền về MB Bank" ở mặt tiền.
  // (SSR: chưa đọc localStorage nên badge hiện "Thông báo, 4 chưa đọc".)
  check("header: notification bell present (aria-label Thông báo)", html.includes('aria-label="Thông báo'), "bell missing");
  check("home: no customer-facing 'tiền về MB Bank'", !html.includes("tiền về MB Bank") && !html.includes("tiền về thẳng tài khoản MB Bank"), "MB Bank leak on home");
  check("home: footer says VietQR qua PayOS (generic)", html.includes("Thanh toán an toàn qua VietQR (PayOS)"), "generic payment line missing");
  res = await fetch(`${BASE}/san-pham`);
  const listHtml = await res.text();
  check("list /san-pham renders", res.ok && listHtml.includes("sản phẩm"));
  const gameBadgesList = listHtml.split("Thẻ game · chọn mệnh giá").length - 1;
  check("list: exactly 2 game-card badges (Garena + Zing, 1 card each)", gameBadgesList === 2, `got ${gameBadgesList}`);
  check("list: cards have both buttons", (listHtml.split("Thêm vào giỏ").length - 1) >= 5 && (listHtml.split("Mua ngay").length - 1) >= 5, "buttons missing on list");

  // 3. Chi tiết sản phẩm (CapCut Pro) — pill selector "Chọn gói" + giá theo gói
  res = await fetch(`${BASE}/tai-khoan-ban-quyen/capcut-pro`);
  html = await res.text();
  check("detail CapCut Pro renders", res.ok && html.includes("CapCut"));
  check("detail: option pill group label", html.includes("Chọn gói"), "no 'Chọn gói' label in SSR HTML");
  check("detail: both 'Mua ngay' and 'Thêm vào giỏ hàng' buttons", html.includes("Mua ngay") && html.includes("Thêm vào giỏ hàng"), "detail buttons missing");
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

  // 5. Tạo đơn demo (chế độ chưa có PayOS) — gói auto CapCut 30 ngày.
  //    Ngoại lệ: ở chế độ CHECK_SERVICE_ROLE_GUARD=1 (Supabase đã cấu hình
  //    nhưng thiếu service_role), tạo đơn PHẢI thất bại với lỗi rõ ràng nhắc
  //    thiếu key — các bước phụ thuộc đơn (7, 8) được bỏ qua ở chế độ này.
  const guardMode = process.env.CHECK_SERVICE_ROLE_GUARD === "1";
  res = await fetch(`${BASE}/api/payos/create-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ variantId: "v-cc-30d", qty: 1 }],
      customer: { name: "Test User", email: "test@example.com", phone: "0900000000" },
    }),
  });
  const created = await res.json();
  let orderCode = null;
  if (guardMode) {
    check(
      "guard mode: create-payment fails with clear env error, not RLS text",
      !res.ok && typeof created.error === "string" && created.error.includes("SUPABASE_SERVICE_ROLE_KEY") && !created.error.includes("permission denied"),
      JSON.stringify(created).slice(0, 200),
    );
  } else {
    check("create-payment demo returns orderCode", res.ok && typeof created.orderCode === "string", JSON.stringify(created).slice(0, 200));
    orderCode = created.orderCode;
  }

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

  // 12. Trang giỏ / thanh toán / tài khoản render được (không 404, không trắng)
  for (const [label, path] of [
    ["cart page", "/gio-hang"],
    ["checkout page", "/thanh-toan"],
    ["account page", "/tai-khoan"],
    ["account manage page", "/tai-khoan/quan-ly"],
  ]) {
    res = await fetch(`${BASE}${path}`);
    const pHtml = await res.text();
    check(`${label} renders`, res.ok && pHtml.includes("VDigital"), `got ${res.status}`);
  }

  // 12b. Trang Quản lý tài khoản: khách chưa đăng nhập thấy CTA đăng nhập;
  // các mục (đổi mật khẩu / phương thức / đăng xuất) nằm trong source, chỉ
  // render khi đã đăng nhập.
  res = await fetch(`${BASE}/tai-khoan/quan-ly`);
  html = await res.text();
  check("account manage: guest sees login CTA", res.ok && html.includes("Quản lý tài khoản") && html.includes("Đăng nhập / Đăng ký"), `got ${res.status}`);
  const manageSrc = readFileSync(new URL("../app/tai-khoan/quan-ly/page.tsx", import.meta.url), "utf8");
  check("account manage: has change-password section in source", manageSrc.includes("Đổi mật khẩu") && manageSrc.includes("Mật khẩu hiện tại") && manageSrc.includes("Xác nhận mật khẩu mới"), "password fields missing in source");
  check("account manage: has login methods + logout in source", manageSrc.includes("Phương thức đăng nhập") && manageSrc.includes("Đăng xuất") && manageSrc.includes("Đơn hàng của tôi"));
  res = await fetch(`${BASE}/tai-khoan`);
  html = await res.text();
  check("account page: no password change (moved to /tai-khoan/quan-ly)", !html.includes("Đổi mật khẩu"), "password change still on /tai-khoan");

  // 13. Guard thiếu service_role — đã kiểm ở bước 5 khi CHECK_SERVICE_ROLE_GUARD=1
  //    (tạo đơn trả lỗi rõ ràng nhắc thiếu key, không phải text RLS).

  // 14. v4 — số liệu thật, không còn số seed giả.
  // 14a. Số danh mục "Tất cả" khớp số sản phẩm thật trong catalog API.
  //     (SSR chèn <!-- --> giữa text và số nên phải gỡ comment trước.)
  const totalMatch = listHtml.replace(/<!-- -->/g, "").match(/Tất cả \((\d+)\)/);
  check("v4: category 'Tất cả' count matches catalog", !!totalMatch && Number(totalMatch[1]) === catalog.products.length, `got ${totalMatch?.[1]} vs ${catalog.products.length}`);
  // 14b. Không còn số seed giả trong HTML trang chủ: không làm tròn "3.5k",
  //      không "Đã bán 3500/6800"; sản phẩm chưa bán hiện "Mới mở bán".
  res = await fetch(`${BASE}/`);
  const homeHtml = await res.text();
  check("v4: no fake sold numbers in home HTML", !homeHtml.includes("3.5k") && !homeHtml.includes("Đã bán 3500") && !homeHtml.includes("Đã bán 6800"), "fake sold count in HTML");
  check("v4: unsold products show 'Mới mở bán'", homeHtml.includes("Mới mở bán"), "'Mới mở bán' missing");
  // 14c. Không còn sao giả 4.9 (dạng text ">4.9<" hoặc "4.9/5" — "4.9" trong
  //      path SVG của icon không tính); chưa có review thì hiện "Chưa có đánh giá".
  check("v4: no fake 4.9 rating in home HTML", !homeHtml.includes(">4.9<") && !homeHtml.includes("4.9/5"), "fake 4.9 in HTML");
  check("v4: no reviews shows 'Chưa có đánh giá'", homeHtml.includes("Chưa có đánh giá"), "'Chưa có đánh giá' missing");
  // 14d. Không còn khuyến mãi giả hướng khách.
  check("v4: no fake promos (20% first order / 10.000+ customers)", !homeHtml.includes("Giảm ngay 20%") && !homeHtml.includes("Giảm 10% cho đơn đầu") && !homeHtml.includes("10.000+"), "fake promo in HTML");
  // 14e. API đánh giá thật: chưa có review nào (demo, không Supabase).
  res = await fetch(`${BASE}/api/reviews?productId=p-capcut`);
  const revs = await res.json();
  check("v4: GET /api/reviews empty when no reviews", res.ok && revs.count === 0 && Array.isArray(revs.reviews) && revs.reviews.length === 0, JSON.stringify(revs).slice(0, 150));
  // 14f. API admin mới: không auth -> 403.
  for (const [label, path] of [
    ["stock", "/api/admin/stock"],
    ["insights", "/api/admin/insights"],
    ["email-templates", "/api/admin/email-templates"],
  ]) {
    res = await fetch(`${BASE}${path}`);
    check(`v4: admin ${label} API without auth returns 403`, res.status === 403, `got ${res.status}`);
  }
  // 14g. Ghi lượt xem: POST /api/track luôn trả ok (kể cả khi chưa có bảng).
  res = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/san-pham" }),
  });
  check("v4: POST /api/track returns ok", res.ok && (await res.json()).ok === true, `got ${res.status}`);
  // 14h. Gói làm tay có manual_fields trong catalog; thiếu thông tin bắt buộc
  //      thì tạo đơn bị từ chối 400 (validate phía server).
  const canva = catalog.products.find((p) => p.slug === "canva-pro");
  const canvaManual = canva?.variants.find((v) => v.fulfillment_type === "manual");
  check("v4: manual variant has manual_fields in catalog", Array.isArray(canvaManual?.manual_fields) && canvaManual.manual_fields.length >= 1 && canvaManual.manual_fields[0].label.includes("Email"), JSON.stringify(canvaManual?.manual_fields).slice(0, 150));
  if (canvaManual) {
    res = await fetch(`${BASE}/api/payos/create-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ variantId: canvaManual.id, qty: 1 }],
        customer: { name: "Test User", email: "test@example.com", phone: "0900000000" },
      }),
    });
    const missing = await res.json();
    check("v4: manual order without required info rejected (400)", res.status === 400 && typeof missing.error === "string" && missing.error.includes("Thiếu thông tin bắt buộc"), `got ${res.status} ${JSON.stringify(missing).slice(0, 150)}`);
    res = await fetch(`${BASE}/api/payos/create-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ variantId: canvaManual.id, qty: 1, customerInfo: { "mf-email": "khach@gmail.com" } }],
        customer: { name: "Test User", email: "test@example.com", phone: "0900000000" },
      }),
    });
    const withInfo = await res.json();
    check("v4: manual order with required info accepted", res.ok && typeof withInfo.orderCode === "string", JSON.stringify(withInfo).slice(0, 150));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e.message);
  process.exit(1);
});
