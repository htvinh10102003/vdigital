import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/AppShell";

/**
 * Typography — một họ phông duy nhất (Inter) cho cả tiêu đề lẫn nội dung.
 * Be Vietnam Pro đã bỏ (26/11): dấu tiếng Việt của nó ở độ đậm lớn mảnh
 * hơn hẳn nét chữ gốc (thấy rõ ở "Tiện lợi", "tháng", "TÀI KHOẢN BẢN
 * QUYỀN") — Inter vẽ dấu đậm đều nét với chữ gốc ở mọi cỡ. Độ đậm tối
 * đa 800, không dùng 900.
 */
const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VDigital — Tài khoản bản quyền số & thẻ game giá tốt",
  description:
    "VDigital — mua tài khoản bản quyền số (ChatGPT, Canva, CapCut, YouTube Premium, Microsoft 365, Gemini Pro, Muse AI) và thẻ game Garena, Zing. Thanh toán VietQR tự động, giao hàng ngay.",
  icons: { icon: "/favicon.svg" },
};

/** Viewport mobile-first: đúng chiều rộng thiết bị, KHÔNG khóa zoom (a11y). */
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const revalidate = 60;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Màn hình chờ kiểu AWSAMELIE: HTML đầu tiên đã có splash (logo + xoay
  // tròn + "Kiểm tra đăng nhập…") nên mở shop là thấy ngay, không còn trắng
  // trang 2-3 giây. Catalog KHÔNG lấy ở server nữa (đó chính là thứ làm
  // byte đầu tiên chậm) — client tải sau khi mount (Providers), còn nội
  // dung trang chủ vẫn render phía server như trước.
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.variable}>
        <div
          id="vd-boot"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#0a0f1e] text-white"
        >
          <img src="/favicon.svg" alt="VDigital" className="h-16 w-16" />
          <div
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-violet-500"
            aria-hidden="true"
          />
          <p id="vd-boot-text" className="text-sm font-semibold text-white/85">
            Kiểm tra đăng nhập…
          </p>
          <p className="text-xs text-white/40">VDigital — Tài khoản số giá tốt</p>
        </div>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
