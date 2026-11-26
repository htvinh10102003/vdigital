-- VDigital — seed dữ liệu mẫu (chạy sau 001_schema.sql)
-- Khớp với lib/seed.ts. Admin sửa/giá/mô tả sau trong /admin, không cần sửa file này.

insert into categories (id, slug, name, parent_id, sort_order) values
  ('cat-tkbq','tai-khoan-ban-quyen','Tài Khoản Bản Quyền',null,1),
  ('cat-tk','thiet-ke-sang-tao','Thiết kế & sáng tạo','cat-tkbq',1),
  ('cat-ai','ai-cong-cu-lam-viec','AI & công cụ làm việc','cat-tkbq',2),
  ('cat-gt','giai-tri','Giải trí','cat-tkbq',3),
  ('cat-vpn','vpn-tien-ich','VPN & tiện ích','cat-tkbq',4),
  ('cat-game','the-game','Thẻ game',null,2),
  ('cat-tool','cong-cu','Công cụ',null,3)
on conflict (id) do nothing;

insert into products (id, slug, category_id, name, tagline, description, guide, warranty_days, rating, review_count, sold_count, is_featured, is_new, is_best_seller, gradient, initials) values
  ('p-capcut','capcut-pro','cat-tk','CapCut Pro','Tài khoản CapCut Pro — mở full tính năng chỉnh sửa video.','CapCut Pro mở khóa toàn bộ hiệu ứng, template, bộ lọc cao cấp, xuất video không watermark và dung lượng lưu trữ đám mây lớn hơn. Tài khoản dùng riêng, bảo hành theo gói.','Bước 1: Đăng nhập tài khoản VDigital và chọn gói CapCut Pro. Bước 2: Thanh toán bằng VietQR — hệ thống tự xác nhận. Bước 3: Vào Đơn hàng của tôi để lấy thông tin tài khoản. Bước 4: Đăng xuất tài khoản CapCut cũ trên thiết bị. Bước 5: Đăng nhập bằng tài khoản CapCut Pro mới và dùng ngay.',30,4.9,37,3500,true,false,true,'from-violet-600 to-fuchsia-500','CC'),
  ('p-canva','canva-pro','cat-tk','Canva Pro','Canva Pro — thiết kế không giới hạn, mời vào team chính chủ.','Canva Pro mở khóa hàng triệu template, ảnh, font và công cụ AI Magic Studio. Shop mời bạn vào team Pro bằng email của bạn — không cần đưa mật khẩu.','Bước 1: Đặt hàng và thanh toán. Bước 2: Đơn chuyển sang Chờ xử lý — shop sẽ gửi lời mời vào team Canva Pro tới email bạn đã đặt hàng. Bước 3: Mở email, bấm chấp nhận lời mời. Bước 4: Vào Canva, kiểm tra đã hiện Pro rồi dùng ngay.',30,4.9,52,2800,true,false,true,'from-cyan-500 to-blue-600','CA'),
  ('p-m365','microsoft-365','cat-ai','Microsoft 365','Microsoft 365 — Word, Excel, PowerPoint + OneDrive 1TB.','Microsoft 365 bản quyền gồm Word, Excel, PowerPoint, Outlook và 1TB OneDrive. Shop nâng cấp trên email chính chủ của bạn hoặc mời vào Family.','Bước 1: Đặt hàng và thanh toán. Bước 2: Shop liên hệ qua email/Zalo để lấy email Microsoft của bạn (nếu gói yêu cầu). Bước 3: Nhận lời mời Family hoặc xác nhận nâng cấp. Bước 4: Đăng nhập Microsoft 365 và dùng full tính năng.',30,4.8,41,1900,true,false,false,'from-blue-600 to-sky-500','M3'),
  ('p-chatgpt','chatgpt-plus','cat-ai','ChatGPT Plus / Go','ChatGPT Plus — nâng cấp trên email chính chủ của bạn.','ChatGPT Plus mở khóa GPT-5, tốc độ trả lời nhanh hơn, tạo ảnh, phân tích file và dùng không giới hạn giờ cao điểm. Gói Go giá rẻ cho nhu cầu nhẹ. Shop nâng cấp trực tiếp trên email của bạn.','Bước 1: Đặt hàng và thanh toán. Bước 2: Đơn chuyển sang Chờ xử lý — shop nâng cấp tài khoản ChatGPT trên email bạn đã cung cấp. Bước 3: Kiểm tra tài khoản đã hiện Plus/Go. Bước 4: Dùng ngay, không cần đổi mật khẩu.',30,4.9,64,4200,true,false,true,'from-emerald-500 to-teal-600','GP'),
  ('p-gemini','google-ai-pro','cat-ai','Google AI Pro (Gemini Pro)','Gemini Pro + 2TB Google One — nâng cấp chính chủ.','Google AI Pro gồm Gemini Advanced, 2TB dung lượng Google One, tích hợp AI trong Gmail, Docs và Sheets. Shop nâng cấp trên email Google chính chủ của bạn.','Bước 1: Đặt hàng và thanh toán. Bước 2: Shop liên hệ để lấy email Google của bạn. Bước 3: Nhận lời mời / xác nhận nâng cấp. Bước 4: Mở Gemini, kiểm tra đã hiện Pro rồi dùng.',30,4.8,28,1500,true,true,false,'from-blue-500 to-indigo-600','GE'),
  ('p-claude','claude-ai','cat-ai','Muse AI — gói token','Muse AI — AI Agent của Meta, mua theo gói token.','Muse AI là AI agent chạy việc, viết code, tra cứu và tự động hoá theo yêu cầu. Mua theo gói token: dùng hết token thì mua thêm, không lo gia hạn tháng.','Bước 1: Chọn gói token và thanh toán. Bước 2: Hệ thống tự xác nhận và giao mã kích hoạt trong Đơn hàng của tôi. Bước 3: Nhập mã vào tài khoản Muse AI của bạn. Bước 4: Kiểm tra số token đã cộng rồi dùng.',30,4.7,19,860,false,true,false,'from-orange-500 to-amber-500','MU'),
  ('p-youtube','youtube-premium','cat-gt','YouTube Premium','YouTube Premium chính chủ — không quảng cáo, nghe nền.','YouTube Premium: xem không quảng cáo, phát nền, tải offline và kèm YouTube Music. Shop thêm bạn vào Family chính chủ, dùng trên email của bạn.','Bước 1: Đặt hàng và thanh toán. Bước 2: Shop gửi lời mời Family tới email Google của bạn. Bước 3: Mở email, bấm chấp nhận lời mời. Bước 4: Mở YouTube, kiểm tra đã hiện Premium rồi dùng.',30,4.9,73,5100,true,false,true,'from-red-600 to-rose-500','YT'),
  ('p-netflix','netflix-premium','cat-gt','Netflix Premium','Netflix Premium 4K — tài khoản riêng, xem ngay.','Netflix Premium chất lượng 4K Ultra HD, xem trên 4 thiết bị cùng lúc. Tài khoản giao ngay sau khi thanh toán.','Bước 1: Chọn gói và thanh toán. Bước 2: Hệ thống tự xác nhận và giao tài khoản trong Đơn hàng của tôi. Bước 3: Đăng nhập Netflix bằng tài khoản vừa nhận. Bước 4: Tạo hồ sơ (profile) riêng của bạn và xem.',30,4.8,46,2300,false,false,true,'from-neutral-800 to-red-700','NF'),
  ('p-spotify','spotify-premium','cat-gt','Spotify Premium','Spotify Premium — nghe không quảng cáo, tải offline.','Spotify Premium: nghe nhạc không quảng cáo, tải nhạc offline, phát nhạc chất lượng cao. Shop thêm bạn vào Family trên email của bạn.','Bước 1: Đặt hàng và thanh toán. Bước 2: Shop gửi lời mời Family tới email Spotify của bạn. Bước 3: Mở email, bấm chấp nhận. Bước 4: Mở Spotify, kiểm tra đã hiện Premium rồi nghe.',30,4.8,33,1700,false,false,false,'from-green-500 to-emerald-600','SP'),
  ('p-nordvpn','nordvpn','cat-vpn','NordVPN','NordVPN — bảo mật & đổi IP, dùng 6 thiết bị.','NordVPN bảo vệ kết nối, ẩn IP, chặn theo dõi và mở nội dung theo vùng. Tài khoản giao ngay sau khi thanh toán.','Bước 1: Chọn gói và thanh toán. Bước 2: Nhận tài khoản trong Đơn hàng của tôi. Bước 3: Tải app NordVPN, đăng nhập. Bước 4: Chọn server và kết nối.',30,4.7,15,640,false,false,false,'from-indigo-600 to-blue-500','NV'),
  ('p-garena','the-garena','cat-game','Thẻ Garena','Thẻ Garena — nạp Liên Quân, Free Fire, FC Online.','Thẻ Garena chính hãng, nạp được Liên Quân Mobile, Free Fire, FC Online và các game Garena khác. Sau khi thanh toán, admin gửi mã thẻ (serial + mã nạp) qua email và trong đơn hàng.','Bước 1: Chọn mệnh giá và thanh toán. Bước 2: Shop gửi mã thẻ qua email (serial + mã nạp). Bước 3: Vào trang nạp Garena, chọn game. Bước 4: Nhập serial và mã nạp để nhận vật phẩm.',7,4.9,58,6800,true,false,true,'from-orange-600 to-red-500','GA'),
  ('p-zing','the-zing','cat-game','Thẻ Zing','Thẻ Zing — nạp Võ Lâm, Gunny, ZingSpeed.','Thẻ Zing chính hãng, nạp được các game của VNG. Sau khi thanh toán, admin gửi mã thẻ (serial + mã nạp) qua email và trong đơn hàng.','Bước 1: Chọn mệnh giá và thanh toán. Bước 2: Shop gửi mã thẻ qua email (serial + mã nạp). Bước 3: Vào trang nạp Zing, chọn game. Bước 4: Nhập serial và mã nạp để nhận vật phẩm.',7,4.9,44,5200,true,false,true,'from-yellow-500 to-orange-500','ZI'),
  ('p-elevenlabs','elevenlabs-creator','cat-ai','ElevenLabs Creator','ElevenLabs Creator — giọng đọc AI giống người thật.','ElevenLabs Creator: tạo giọng đọc AI chất lượng cao, nhân bản giọng, làm video/podcast. Tài khoản giao ngay sau khi thanh toán.','Bước 1: Chọn gói và thanh toán. Bước 2: Nhận tài khoản trong Đơn hàng của tôi. Bước 3: Đăng nhập ElevenLabs. Bước 4: Tạo giọng đọc ngay.',30,4.6,12,410,false,true,false,'from-violet-500 to-purple-600','EL')
on conflict (id) do nothing;

insert into variants (id, product_id, name, label, price, original_price, fulfillment_type, is_flash, flash_ends_at, stock_count, sort_order) values
  ('v-cc-7d','p-capcut','7 ngày','7 ngày',15000,49000,'auto',false,null,null,1),
  ('v-cc-30d','p-capcut','30 ngày','30 ngày',55000,220000,'auto',true,now() + interval '14 hours',null,2),
  ('v-cc-2m','p-capcut','2 tháng','2 tháng',80000,320000,'auto',false,null,null,3),
  ('v-cc-3m','p-capcut','3 tháng','3 tháng',150000,450000,'auto',false,null,null,4),
  ('v-cc-6m','p-capcut','6–7 tháng','6–7 tháng',350000,900000,'auto',false,null,null,5),
  ('v-cc-12m','p-capcut','12 tháng','12 tháng',800000,1800000,'auto',false,null,null,6),
  ('v-cc-2y','p-capcut','2 năm','2 năm',1200000,2400000,'auto',false,null,0,7),
  ('v-cv-1m','p-canva','1 tháng','1 tháng',25000,99000,'manual',false,null,null,1),
  ('v-cv-3m','p-canva','3 tháng','3 tháng',59000,199000,'manual',false,null,null,2),
  ('v-cv-12m','p-canva','12 tháng','12 tháng',149000,499000,'manual',true,now() + interval '14 hours',null,3),
  ('v-m365-1m','p-m365','1 tháng','1 tháng',49000,149000,'manual',false,null,null,1),
  ('v-m365-12m','p-m365','12 tháng','12 tháng',299000,899000,'manual',true,now() + interval '14 hours',null,2),
  ('v-gpt-plus-1m','p-chatgpt','Plus — 1 tháng','Plus — 1 tháng',299000,520000,'manual',false,null,null,1),
  ('v-gpt-go-3m','p-chatgpt','Go — 3 tháng','Go — 3 tháng',199000,299000,'auto',false,null,null,2),
  ('v-ge-1m','p-gemini','1 tháng','1 tháng',99000,299000,'manual',false,null,null,1),
  ('v-ge-6m','p-gemini','6 tháng','6 tháng',499000,999000,'manual',false,null,null,2),
  ('v-ge-18m','p-gemini','18 tháng','18 tháng',999000,1999000,'manual',true,now() + interval '14 hours',null,3),
  ('v-mu-1b','p-claude','1 tỷ token','1 tỷ token',199000,399000,'auto',false,null,null,1),
  ('v-mu-2b','p-claude','2 tỷ token','2 tỷ token',349000,699000,'auto',false,null,null,2),
  ('v-mu-31b','p-claude','31 tỷ token','31 tỷ token',2999000,5999000,'auto',true,now() + interval '14 hours',null,3),
  ('v-yt-1m','p-youtube','1 tháng','1 tháng',49000,109000,'manual',false,null,null,1),
  ('v-yt-3m','p-youtube','3 tháng','3 tháng',129000,259000,'manual',false,null,null,2),
  ('v-yt-12m','p-youtube','12 tháng','12 tháng',399000,799000,'manual',true,now() + interval '14 hours',null,3),
  ('v-nf-1m','p-netflix','1 tháng','1 tháng',79000,179000,'auto',false,null,null,1),
  ('v-nf-3m','p-netflix','3 tháng','3 tháng',199000,399000,'auto',false,null,null,2),
  ('v-sp-1m','p-spotify','1 tháng','1 tháng',29000,59000,'manual',false,null,null,1),
  ('v-sp-3m','p-spotify','3 tháng','3 tháng',69000,149000,'manual',false,null,null,2),
  ('v-sp-12m','p-spotify','12 tháng','12 tháng',199000,399000,'manual',false,null,null,3),
  ('v-nv-12m','p-nordvpn','12 tháng','12 tháng',499000,999000,'auto',false,null,null,1),
  ('v-nv-24m','p-nordvpn','24 tháng','24 tháng',799000,1499000,'auto',false,null,null,2),
  ('v-ga-20000','p-garena','20K','20K',20000,20000,'game_card',false,null,null,1),
  ('v-ga-50000','p-garena','50K','50K',50000,50000,'game_card',false,null,null,2),
  ('v-ga-100000','p-garena','100K','100K',100000,100000,'game_card',false,null,null,3),
  ('v-ga-200000','p-garena','200K','200K',200000,200000,'game_card',false,null,null,4),
  ('v-ga-500000','p-garena','500K','500K',500000,500000,'game_card',false,null,null,5),
  ('v-zi-20000','p-zing','20K','20K',20000,20000,'game_card',false,null,null,1),
  ('v-zi-50000','p-zing','50K','50K',50000,50000,'game_card',false,null,null,2),
  ('v-zi-100000','p-zing','100K','100K',100000,100000,'game_card',false,null,null,3),
  ('v-zi-200000','p-zing','200K','200K',200000,200000,'game_card',false,null,null,4),
  ('v-zi-500000','p-zing','500K','500K',500000,500000,'game_card',false,null,null,5),
  ('v-el-3m','p-elevenlabs','3 tháng','3 tháng',299000,599000,'auto',false,null,null,1)
on conflict (id) do nothing;

insert into banners (id, title, subtitle, cta_text, cta_link, gradient, sort_order) values
  ('b1','Tài khoản bản quyền giá tốt','ChatGPT, Canva, CapCut, YouTube Premium… giao ngay sau khi thanh toán.','Xem tài khoản bản quyền','/tai-khoan-ban-quyen','from-navy-800 via-indigo-900 to-navy-900',1),
  ('b2','Thẻ game chính hãng','Thẻ Garena, Zing đủ mệnh giá — admin gửi mã qua email sau vài phút.','Mua thẻ game','/the-game','from-orange-600 via-red-600 to-navy-900',2),
  ('b3','Flash Sale mỗi ngày','Giảm tới 75% tài khoản số — số lượng có hạn, hết là hết.','Xem ưu đãi','/khuyen-mai','from-emerald-600 via-teal-700 to-navy-900',3)
on conflict (id) do nothing;

insert into faqs (id, question, answer, sort_order) values
  ('f1','Mua xong bao lâu thì nhận được tài khoản / mã?','Sản phẩm giao tự động (tài khoản có sẵn trong kho) sẽ hiện ngay trong chi tiết đơn hàng sau khi hệ thống xác nhận thanh toán, thường trong vài phút. Sản phẩm làm tay (nâng cấp chính chủ, add Family) và thẻ game cần admin xử lý, thường trong 5–30 phút trong giờ làm việc.',1),
  ('f2','Thanh toán bằng những cách nào?','Thanh toán bằng VietQR qua PayOS: quét mã, chuyển khoản đúng số tiền và nội dung, hệ thống tự xác nhận và duyệt đơn — không thu phí giao dịch, tiền về thẳng tài khoản MB Bank của shop. Ngoài ra còn hỗ trợ chuyển khoản ngân hàng thủ công.',2),
  ('f3','Tài khoản dùng được trên mấy thiết bị?','Tùy từng sản phẩm: tài khoản dùng riêng không giới hạn thiết bị của bạn; tài khoản Family dùng trên email chính chủ của bạn. Chi tiết ghi rõ trong phần mô tả của từng gói.',3),
  ('f4','Tài khoản là dùng chung hay dùng riêng?','Có cả hai loại và shop ghi rõ ở từng sản phẩm: loại dùng riêng (tài khoản giao cho bạn) và loại nâng cấp chính chủ / Family (nâng cấp trên email của bạn, không cần đưa mật khẩu).',4),
  ('f5','Chính sách bảo hành / đổi trả như thế nào?','Bảo hành 1 đổi 1 trong thời gian ghi ở từng gói nếu tài khoản lỗi do shop. Thẻ game đã giao mã thành công thì không đổi trả. Bạn chỉ cần cung cấp mã đơn hàng khi cần hỗ trợ.',5),
  ('f6','Cần hỗ trợ thì liên hệ ở đâu?','Liên hệ qua Zalo hoặc Messenger ở góc phải màn hình, hoặc gửi email cho shop. Khi cần hỗ trợ đơn hàng, hãy gửi kèm mã đơn (vd VD261126-XXXX) để shop tra nhanh.',6)
on conflict (id) do nothing;

-- Mã kho DEMO cho gói giao tự động (3 mã / gói) — admin PHẢI thay bằng mã thật trước khi bán.
insert into stock_codes (variant_id, code)
select v.id, 'VD-DEMO-' || upper(v.id) || '-00' || g
from variants v, generate_series(1,3) g
where v.fulfillment_type = 'auto'
on conflict do nothing;
