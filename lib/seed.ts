import type { Banner, Catalog, Category, Faq, Product, Variant } from "./types";

// Dữ liệu gốc của shop. Đây là dữ liệu SEED — khi đã cấu hình Supabase,
// dữ liệu thật sống trong DB và sửa được trong /admin (không sửa code).
// Ảnh sản phẩm là gradient + chữ cái đầu, KHÔNG dùng logo/ảnh của hãng khác.

const FLASH_END = new Date(Date.now() + 14 * 3600 * 1000).toISOString();
const NOW = new Date().toISOString();

export const CATEGORIES: Category[] = [
  { id: "cat-tkbq", slug: "tai-khoan-ban-quyen", name: "Tài Khoản Bản Quyền", parent_id: null, sort_order: 1 },
  { id: "cat-tk", slug: "thiet-ke-sang-tao", name: "Thiết kế & sáng tạo", parent_id: "cat-tkbq", sort_order: 1 },
  { id: "cat-ai", slug: "ai-cong-cu-lam-viec", name: "AI & công cụ làm việc", parent_id: "cat-tkbq", sort_order: 2 },
  { id: "cat-gt", slug: "giai-tri", name: "Giải trí", parent_id: "cat-tkbq", sort_order: 3 },
  { id: "cat-vpn", slug: "vpn-tien-ich", name: "VPN & tiện ích", parent_id: "cat-tkbq", sort_order: 4 },
  { id: "cat-game", slug: "the-game", name: "Thẻ game", parent_id: null, sort_order: 2 },
  { id: "cat-tool", slug: "cong-cu", name: "Công cụ", parent_id: null, sort_order: 3 },
];

function v(
  id: string,
  product_id: string,
  label: string,
  price: number,
  original_price: number,
  fulfillment_type: Variant["fulfillment_type"],
  opts: Partial<Variant> = {},
): Variant {
  return {
    id,
    product_id,
    name: label,
    label,
    price,
    original_price,
    fulfillment_type,
    is_flash: false,
    flash_ends_at: null,
    stock_count: null,
    is_active: true,
    sort_order: 0,
    ...opts,
  };
}

const PRODUCTS: Product[] = [
  {
    id: "p-capcut",
    slug: "capcut-pro",
    category_id: "cat-tk",
    name: "CapCut Pro",
    tagline: "Tài khoản CapCut Pro — mở full tính năng chỉnh sửa video.",
    description:
      "CapCut Pro mở khóa toàn bộ hiệu ứng, template, bộ lọc cao cấp, xuất video không watermark và dung lượng lưu trữ đám mây lớn hơn. Tài khoản dùng riêng, bảo hành theo gói.",
    guide:
      "Bước 1: Đăng nhập tài khoản VDigital và chọn gói CapCut Pro.\nBước 2: Thanh toán bằng VietQR — hệ thống tự xác nhận.\nBước 3: Vào Đơn hàng của tôi để lấy thông tin tài khoản.\nBước 4: Đăng xuất tài khoản CapCut cũ trên thiết bị.\nBước 5: Đăng nhập bằng tài khoản CapCut Pro vừa nhận và dùng ngay.",
    warranty_days: 30,
    rating: 4.9,
    review_count: 37,
    sold_count: 3500,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-violet-600 to-fuchsia-500",
    initials: "CC",
    created_at: NOW,
    variants: [
      v("v-cc-7d", "p-capcut", "7 ngày", 15000, 49000, "auto", { sort_order: 1 }),
      v("v-cc-30d", "p-capcut", "30 ngày", 55000, 220000, "auto", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 2 }),
      v("v-cc-2m", "p-capcut", "2 tháng", 80000, 320000, "auto", { sort_order: 3 }),
      v("v-cc-3m", "p-capcut", "3 tháng", 150000, 450000, "auto", { sort_order: 4 }),
      v("v-cc-6m", "p-capcut", "6–7 tháng", 350000, 900000, "auto", { sort_order: 5 }),
      v("v-cc-12m", "p-capcut", "12 tháng", 800000, 1800000, "auto", { sort_order: 6 }),
      v("v-cc-2y", "p-capcut", "2 năm", 1200000, 2400000, "auto", { stock_count: 0, sort_order: 7 }),
    ],
  },
  {
    id: "p-canva",
    slug: "canva-pro",
    category_id: "cat-tk",
    name: "Canva Pro",
    tagline: "Canva Pro — thiết kế không giới hạn, mời vào team chính chủ.",
    description:
      "Canva Pro mở khóa hàng triệu template, ảnh, font và công cụ AI Magic Studio. Shop mời bạn vào team Pro bằng email của bạn — không cần đưa mật khẩu.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Đơn chuyển sang Chờ xử lý — shop sẽ gửi lời mời vào team Canva Pro tới email bạn đã đặt hàng.\nBước 3: Mở email, bấm chấp nhận lời mời.\nBước 4: Vào Canva, kiểm tra đã hiện Pro rồi dùng ngay.",
    warranty_days: 30,
    rating: 4.9,
    review_count: 52,
    sold_count: 2800,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-cyan-500 to-blue-600",
    initials: "CA",
    created_at: NOW,
    variants: [
      v("v-cv-1m", "p-canva", "1 tháng", 25000, 99000, "manual", { sort_order: 1 }),
      v("v-cv-3m", "p-canva", "3 tháng", 59000, 199000, "manual", { sort_order: 2 }),
      v("v-cv-12m", "p-canva", "12 tháng", 149000, 499000, "manual", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 3 }),
    ],
  },
  {
    id: "p-m365",
    slug: "microsoft-365",
    category_id: "cat-ai",
    name: "Microsoft 365",
    tagline: "Microsoft 365 — Word, Excel, PowerPoint + OneDrive 1TB.",
    description:
      "Microsoft 365 bản quyền gồm Word, Excel, PowerPoint, Outlook và 1TB OneDrive. Shop nâng cấp trên email chính chủ của bạn hoặc mời vào Family.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Shop liên hệ qua email/Zalo để lấy email Microsoft của bạn (nếu gói yêu cầu).\nBước 3: Nhận lời mời Family hoặc xác nhận nâng cấp.\nBước 4: Đăng nhập Microsoft 365 và dùng full tính năng.",
    warranty_days: 30,
    rating: 4.8,
    review_count: 41,
    sold_count: 1900,
    is_featured: true,
    is_new: false,
    is_best_seller: false,
    is_active: true,
    gradient: "from-blue-600 to-sky-500",
    initials: "M3",
    created_at: NOW,
    variants: [
      v("v-m365-1m", "p-m365", "1 tháng", 49000, 149000, "manual", { sort_order: 1 }),
      v("v-m365-12m", "p-m365", "12 tháng", 299000, 899000, "manual", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 2 }),
    ],
  },
  {
    id: "p-chatgpt",
    slug: "chatgpt-plus",
    category_id: "cat-ai",
    name: "ChatGPT Plus / Go",
    tagline: "ChatGPT Plus — nâng cấp trên email chính chủ của bạn.",
    description:
      "ChatGPT Plus mở khóa GPT-5, tốc độ trả lời nhanh hơn, tạo ảnh, phân tích file và dùng không giới hạn giờ cao điểm. Gói Go giá rẻ cho nhu cầu nhẹ. Shop nâng cấp trực tiếp trên email của bạn.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Đơn chuyển sang Chờ xử lý — shop nâng cấp tài khoản ChatGPT trên email bạn đã cung cấp.\nBước 3: Kiểm tra tài khoản đã hiện Plus/Go.\nBước 4: Dùng ngay, không cần đổi mật khẩu.",
    warranty_days: 30,
    rating: 4.9,
    review_count: 64,
    sold_count: 4200,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-emerald-500 to-teal-600",
    initials: "GP",
    created_at: NOW,
    variants: [
      v("v-gpt-plus-1m", "p-chatgpt", "Plus — 1 tháng", 299000, 520000, "manual", { sort_order: 1 }),
      v("v-gpt-go-3m", "p-chatgpt", "Go — 3 tháng", 199000, 299000, "auto", { sort_order: 2 }),
    ],
  },
  {
    id: "p-gemini",
    slug: "google-ai-pro",
    category_id: "cat-ai",
    name: "Google AI Pro (Gemini Pro)",
    tagline: "Gemini Pro + 2TB Google One — nâng cấp chính chủ.",
    description:
      "Google AI Pro gồm Gemini Advanced, 2TB dung lượng Google One, tích hợp AI trong Gmail, Docs và Sheets. Shop nâng cấp trên email Google chính chủ của bạn.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Shop liên hệ để lấy email Google của bạn.\nBước 3: Nhận lời mời / xác nhận nâng cấp.\nBước 4: Mở Gemini, kiểm tra đã hiện Pro rồi dùng.",
    warranty_days: 30,
    rating: 4.8,
    review_count: 28,
    sold_count: 1500,
    is_featured: true,
    is_new: true,
    is_best_seller: false,
    is_active: true,
    gradient: "from-blue-500 to-indigo-600",
    initials: "GE",
    created_at: NOW,
    variants: [
      v("v-ge-1m", "p-gemini", "1 tháng", 99000, 299000, "manual", { sort_order: 1 }),
      v("v-ge-6m", "p-gemini", "6 tháng", 499000, 999000, "manual", { sort_order: 2 }),
      v("v-ge-18m", "p-gemini", "18 tháng", 999000, 1999000, "manual", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 3 }),
    ],
  },
  {
    id: "p-claude",
    slug: "claude-ai",
    category_id: "cat-ai",
    name: "Muse AI — gói token",
    tagline: "Muse AI — AI Agent của Meta, mua theo gói token.",
    description:
      "Muse AI là AI agent chạy việc, viết code, tra cứu và tự động hoá theo yêu cầu. Mua theo gói token: dùng hết token thì mua thêm, không lo gia hạn tháng.",
    guide:
      "Bước 1: Chọn gói token và thanh toán.\nBước 2: Hệ thống tự xác nhận và giao mã kích hoạt trong Đơn hàng của tôi.\nBước 3: Nhập mã vào tài khoản Muse AI của bạn.\nBước 4: Kiểm tra số token đã cộng rồi dùng.",
    warranty_days: 30,
    rating: 4.7,
    review_count: 19,
    sold_count: 860,
    is_featured: false,
    is_new: true,
    is_best_seller: false,
    is_active: true,
    gradient: "from-orange-500 to-amber-500",
    initials: "MU",
    created_at: NOW,
    variants: [
      v("v-mu-1b", "p-claude", "1 tỷ token", 199000, 399000, "auto", { sort_order: 1 }),
      v("v-mu-2b", "p-claude", "2 tỷ token", 349000, 699000, "auto", { sort_order: 2 }),
      v("v-mu-31b", "p-claude", "31 tỷ token", 2999000, 5999000, "auto", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 3 }),
    ],
  },
  {
    id: "p-youtube",
    slug: "youtube-premium",
    category_id: "cat-gt",
    name: "YouTube Premium",
    tagline: "YouTube Premium chính chủ — không quảng cáo, nghe nền.",
    description:
      "YouTube Premium: xem không quảng cáo, phát nền, tải offline và kèm YouTube Music. Shop thêm bạn vào Family chính chủ, dùng trên email của bạn.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Shop gửi lời mời Family tới email Google của bạn.\nBước 3: Mở email, bấm chấp nhận lời mời.\nBước 4: Mở YouTube, kiểm tra đã hiện Premium rồi dùng.",
    warranty_days: 30,
    rating: 4.9,
    review_count: 73,
    sold_count: 5100,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-red-600 to-rose-500",
    initials: "YT",
    created_at: NOW,
    variants: [
      v("v-yt-1m", "p-youtube", "1 tháng", 49000, 109000, "manual", { sort_order: 1 }),
      v("v-yt-3m", "p-youtube", "3 tháng", 129000, 259000, "manual", { sort_order: 2 }),
      v("v-yt-12m", "p-youtube", "12 tháng", 399000, 799000, "manual", { is_flash: true, flash_ends_at: FLASH_END, sort_order: 3 }),
    ],
  },
  {
    id: "p-netflix",
    slug: "netflix-premium",
    category_id: "cat-gt",
    name: "Netflix Premium",
    tagline: "Netflix Premium 4K — tài khoản riêng, xem ngay.",
    description:
      "Netflix Premium chất lượng 4K Ultra HD, xem trên 4 thiết bị cùng lúc. Tài khoản giao ngay sau khi thanh toán.",
    guide:
      "Bước 1: Chọn gói và thanh toán.\nBước 2: Hệ thống tự xác nhận và giao tài khoản trong Đơn hàng của tôi.\nBước 3: Đăng nhập Netflix bằng tài khoản vừa nhận.\nBước 4: Tạo hồ sơ (profile) riêng của bạn và xem.",
    warranty_days: 30,
    rating: 4.8,
    review_count: 46,
    sold_count: 2300,
    is_featured: false,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-neutral-800 to-red-700",
    initials: "NF",
    created_at: NOW,
    variants: [
      v("v-nf-1m", "p-netflix", "1 tháng", 79000, 179000, "auto", { sort_order: 1 }),
      v("v-nf-3m", "p-netflix", "3 tháng", 199000, 399000, "auto", { sort_order: 2 }),
    ],
  },
  {
    id: "p-spotify",
    slug: "spotify-premium",
    category_id: "cat-gt",
    name: "Spotify Premium",
    tagline: "Spotify Premium — nghe không quảng cáo, tải offline.",
    description:
      "Spotify Premium: nghe nhạc không quảng cáo, tải nhạc offline, phát nhạc chất lượng cao. Shop thêm bạn vào Family trên email của bạn.",
    guide:
      "Bước 1: Đặt hàng và thanh toán.\nBước 2: Shop gửi lời mời Family tới email Spotify của bạn.\nBước 3: Mở email, bấm chấp nhận.\nBước 4: Mở Spotify, kiểm tra đã hiện Premium rồi nghe.",
    warranty_days: 30,
    rating: 4.8,
    review_count: 33,
    sold_count: 1700,
    is_featured: false,
    is_new: false,
    is_best_seller: false,
    is_active: true,
    gradient: "from-green-500 to-emerald-600",
    initials: "SP",
    created_at: NOW,
    variants: [
      v("v-sp-1m", "p-spotify", "1 tháng", 29000, 59000, "manual", { sort_order: 1 }),
      v("v-sp-3m", "p-spotify", "3 tháng", 69000, 149000, "manual", { sort_order: 2 }),
      v("v-sp-12m", "p-spotify", "12 tháng", 199000, 399000, "manual", { sort_order: 3 }),
    ],
  },
  {
    id: "p-nordvpn",
    slug: "nordvpn",
    category_id: "cat-vpn",
    name: "NordVPN",
    tagline: "NordVPN — bảo mật & đổi IP, dùng 6 thiết bị.",
    description:
      "NordVPN bảo vệ kết nối, ẩn IP, chặn theo dõi và mở nội dung theo vùng. Tài khoản giao ngay sau khi thanh toán.",
    guide:
      "Bước 1: Chọn gói và thanh toán.\nBước 2: Nhận tài khoản trong Đơn hàng của tôi.\nBước 3: Tải app NordVPN, đăng nhập.\nBước 4: Chọn server và kết nối.",
    warranty_days: 30,
    rating: 4.7,
    review_count: 15,
    sold_count: 640,
    is_featured: false,
    is_new: false,
    is_best_seller: false,
    is_active: true,
    gradient: "from-indigo-600 to-blue-500",
    initials: "NV",
    created_at: NOW,
    variants: [
      v("v-nv-12m", "p-nordvpn", "12 tháng", 499000, 999000, "auto", { sort_order: 1 }),
      v("v-nv-24m", "p-nordvpn", "24 tháng", 799000, 1499000, "auto", { sort_order: 2 }),
    ],
  },
  {
    id: "p-garena",
    slug: "the-garena",
    category_id: "cat-game",
    name: "Thẻ Garena",
    tagline: "Thẻ Garena — nạp Liên Quân, Free Fire, FC Online.",
    description:
      "Thẻ Garena chính hãng, nạp được Liên Quân Mobile, Free Fire, FC Online và các game Garena khác. Sau khi thanh toán, admin gửi mã thẻ (serial + mã nạp) qua email và trong đơn hàng.",
    guide:
      "Bước 1: Chọn mệnh giá và thanh toán.\nBước 2: Shop gửi mã thẻ qua email (serial + mã nạp).\nBước 3: Vào trang nạp Garena, chọn game.\nBước 4: Nhập serial và mã nạp để nhận vật phẩm.",
    warranty_days: 7,
    rating: 4.9,
    review_count: 58,
    sold_count: 6800,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-orange-600 to-red-500",
    initials: "GA",
    created_at: NOW,
    variants: [20000, 50000, 100000, 200000, 500000].map((d, i) =>
      v(`v-ga-${d}`, "p-garena", `${d / 1000}K`, d, d, "game_card", { sort_order: i + 1 }),
    ),
  },
  {
    id: "p-zing",
    slug: "the-zing",
    category_id: "cat-game",
    name: "Thẻ Zing",
    tagline: "Thẻ Zing — nạp Võ Lâm, Gunny, ZingSpeed.",
    description:
      "Thẻ Zing chính hãng, nạp được các game của VNG. Sau khi thanh toán, admin gửi mã thẻ (serial + mã nạp) qua email và trong đơn hàng.",
    guide:
      "Bước 1: Chọn mệnh giá và thanh toán.\nBước 2: Shop gửi mã thẻ qua email (serial + mã nạp).\nBước 3: Vào trang nạp Zing, chọn game.\nBước 4: Nhập serial và mã nạp để nhận vật phẩm.",
    warranty_days: 7,
    rating: 4.9,
    review_count: 44,
    sold_count: 5200,
    is_featured: true,
    is_new: false,
    is_best_seller: true,
    is_active: true,
    gradient: "from-yellow-500 to-orange-500",
    initials: "ZI",
    created_at: NOW,
    variants: [20000, 50000, 100000, 200000, 500000].map((d, i) =>
      v(`v-zi-${d}`, "p-zing", `${d / 1000}K`, d, d, "game_card", { sort_order: i + 1 }),
    ),
  },
  {
    id: "p-elevenlabs",
    slug: "elevenlabs-creator",
    category_id: "cat-ai",
    name: "ElevenLabs Creator",
    tagline: "ElevenLabs Creator — giọng đọc AI giống người thật.",
    description:
      "ElevenLabs Creator: tạo giọng đọc AI chất lượng cao, nhân bản giọng, làm video/podcast. Tài khoản giao ngay sau khi thanh toán.",
    guide:
      "Bước 1: Chọn gói và thanh toán.\nBước 2: Nhận tài khoản trong Đơn hàng của tôi.\nBước 3: Đăng nhập ElevenLabs.\nBước 4: Tạo giọng đọc ngay.",
    warranty_days: 30,
    rating: 4.6,
    review_count: 12,
    sold_count: 410,
    is_featured: false,
    is_new: true,
    is_best_seller: false,
    is_active: true,
    gradient: "from-violet-500 to-purple-600",
    initials: "EL",
    created_at: NOW,
    variants: [
      v("v-el-3m", "p-elevenlabs", "3 tháng", 299000, 599000, "auto", { sort_order: 1 }),
    ],
  },
];

export const BANNERS: Banner[] = [
  {
    id: "b1",
    title: "Tài khoản bản quyền giá tốt",
    subtitle: "ChatGPT, Canva, CapCut, YouTube Premium… giao ngay sau khi thanh toán.",
    cta_text: "Xem tài khoản bản quyền",
    cta_link: "/tai-khoan-ban-quyen",
    gradient: "from-navy-800 via-indigo-900 to-navy-900",
    is_active: true,
    sort_order: 1,
  },
  {
    id: "b2",
    title: "Thẻ game chính hãng",
    subtitle: "Thẻ Garena, Zing đủ mệnh giá — admin gửi mã qua email sau vài phút.",
    cta_text: "Mua thẻ game",
    cta_link: "/the-game",
    gradient: "from-orange-600 via-red-600 to-navy-900",
    is_active: true,
    sort_order: 2,
  },
  {
    id: "b3",
    title: "Flash Sale mỗi ngày",
    subtitle: "Giảm tới 75% tài khoản số — số lượng có hạn, hết là hết.",
    cta_text: "Xem ưu đãi",
    cta_link: "/khuyen-mai",
    gradient: "from-emerald-600 via-teal-700 to-navy-900",
    is_active: true,
    sort_order: 3,
  },
];

export const FAQS: Faq[] = [
  {
    id: "f1",
    question: "Mua xong bao lâu thì nhận được tài khoản / mã?",
    answer:
      "Sản phẩm giao tự động (tài khoản có sẵn trong kho) sẽ hiện ngay trong chi tiết đơn hàng sau khi hệ thống xác nhận thanh toán, thường trong vài phút. Sản phẩm làm tay (nâng cấp chính chủ, add Family) và thẻ game cần admin xử lý, thường trong 5–30 phút trong giờ làm việc.",
    sort_order: 1,
  },
  {
    id: "f2",
    question: "Thanh toán bằng những cách nào?",
    answer:
      "Thanh toán bằng VietQR qua PayOS: quét mã, chuyển khoản đúng số tiền và nội dung, hệ thống tự xác nhận và duyệt đơn — không thu phí giao dịch, tiền về thẳng tài khoản MB Bank của shop. Ngoài ra còn hỗ trợ chuyển khoản ngân hàng thủ công.",
    sort_order: 2,
  },
  {
    id: "f3",
    question: "Tài khoản dùng được trên mấy thiết bị?",
    answer:
      "Tùy từng sản phẩm: tài khoản dùng riêng không giới hạn thiết bị của bạn; tài khoản Family dùng trên email chính chủ của bạn. Chi tiết ghi rõ trong phần mô tả của từng gói.",
    sort_order: 3,
  },
  {
    id: "f4",
    question: "Tài khoản là dùng chung hay dùng riêng?",
    answer:
      "Có cả hai loại và shop ghi rõ ở từng sản phẩm: loại dùng riêng (tài khoản giao cho bạn) và loại nâng cấp chính chủ / Family (nâng cấp trên email của bạn, không cần đưa mật khẩu).",
    sort_order: 4,
  },
  {
    id: "f5",
    question: "Chính sách bảo hành / đổi trả như thế nào?",
    answer:
      "Bảo hành 1 đổi 1 trong thời gian ghi ở từng gói nếu tài khoản lỗi do shop. Thẻ game đã giao mã thành công thì không đổi trả. Bạn chỉ cần cung cấp mã đơn hàng khi cần hỗ trợ.",
    sort_order: 5,
  },
  {
    id: "f6",
    question: "Cần hỗ trợ thì liên hệ ở đâu?",
    answer:
      "Liên hệ qua Zalo hoặc Messenger ở góc phải màn hình, hoặc gửi email cho shop. Khi cần hỗ trợ đơn hàng, hãy gửi kèm mã đơn (vd VD261126-XXXX) để shop tra nhanh.",
    sort_order: 6,
  },
];

/** Mã kho DEMO cho các gói giao tự động — admin PHẢI thay bằng mã thật trong /admin > Kho mã trước khi bán thật. */
export const DEMO_STOCK: Record<string, string[]> = {};
for (const p of PRODUCTS) {
  for (const variant of p.variants) {
    if (variant.fulfillment_type === "auto") {
      DEMO_STOCK[variant.id] = [
        `VD-DEMO-${variant.id.toUpperCase()}-001`,
        `VD-DEMO-${variant.id.toUpperCase()}-002`,
        `VD-DEMO-${variant.id.toUpperCase()}-003`,
      ];
    }
  }
}

export const SEED_CATALOG: Catalog = {
  categories: CATEGORIES,
  products: PRODUCTS,
  banners: BANNERS,
  faqs: FAQS,
};

export function findVariant(variantId: string): { product: Product; variant: Variant } | null {
  for (const p of PRODUCTS) {
    const variant = p.variants.find((x) => x.id === variantId);
    if (variant) return { product: p, variant };
  }
  return null;
}
