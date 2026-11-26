// Test logic danh sách admin — chạy: npm run test:admin-emails
// Kiểm chứng lỗi 26/11: đăng nhập bằng contact.hotavinh@gmail.com nhưng
// /admin báo "Không có quyền" khi Vercel đặt ADMIN_EMAILS /
// NEXT_PUBLIC_ADMIN_EMAILS là email khác. Email mặc định phải LUÔN là admin.
// Node 24 chạy trực tiếp file .ts (type stripping) nên import thẳng lib.
import { adminEmails, isAdminEmail, resolveAdminEmails, DEFAULT_ADMIN_EMAIL } from "../lib/supabase.ts";

const DEFAULT = "contact.hotavinh@gmail.com";
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

function setEnv(admin, nextPublic) {
  if (admin === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = admin;
  if (nextPublic === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  else process.env.NEXT_PUBLIC_ADMIN_EMAILS = nextPublic;
}

// 0. Hằng mặc định đúng email Vinh đặt
check("DEFAULT_ADMIN_EMAIL is contact.hotavinh@gmail.com", DEFAULT_ADMIN_EMAIL === DEFAULT);

// 1. Không đặt env gì -> mặc định vẫn là admin
setEnv(undefined, undefined);
check("no env: default is admin", adminEmails().includes(DEFAULT) && isAdminEmail(DEFAULT));

// 2. ADMIN_EMAILS là email khác -> mặc định VẪN là admin (+ email kia)
setEnv("other@example.com", undefined);
check(
  "ADMIN_EMAILS=other: default still admin",
  adminEmails().includes(DEFAULT) && adminEmails().includes("other@example.com") && isAdminEmail(DEFAULT),
  JSON.stringify(adminEmails()),
);

// 3. Chỉ đặt NEXT_PUBLIC_ADMIN_EMAILS là email khác (trường hợp client) -> mặc định VẪN là admin
setEnv(undefined, "someone-else@example.com");
check(
  "NEXT_PUBLIC_ADMIN_EMAILS=other: default still admin",
  adminEmails().includes(DEFAULT) && adminEmails().includes("someone-else@example.com") && isAdminEmail(DEFAULT),
  JSON.stringify(adminEmails()),
);

// 4. Cả hai env đặt email khác nhau -> hợp nhất cả 3
setEnv("a@example.com", "b@example.com");
check(
  "both envs set: union includes default + both",
  ["a@example.com", "b@example.com", DEFAULT].every((e) => adminEmails().includes(e)),
  JSON.stringify(adminEmails()),
);

// 5. Email trong env viết hoa/thừa khoảng trắng -> chuẩn hoá, không trùng lặp
setEnv("  Contact.Hotavinh@Gmail.Com , other@example.com ", undefined);
check(
  "env case/space normalized, no duplicates",
  adminEmails().filter((e) => e === DEFAULT).length === 1 && isAdminEmail("CONTACT.HOTAVINH@GMAIL.COM"),
  JSON.stringify(adminEmails()),
);

// 6. Email lạ không phải admin
setEnv("other@example.com", undefined);
check("random email is not admin", !isAdminEmail("random@example.com") && !isAdminEmail(null) && !isAdminEmail(undefined));

// 7. Hàm thuần dùng phía client (providers.tsx): chỉ có NEXT_PUBLIC_ khác -> mặc định vẫn có
check(
  "resolveAdminEmails('other@example.com') includes default",
  resolveAdminEmails("other@example.com").includes(DEFAULT),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
