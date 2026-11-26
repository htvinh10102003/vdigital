import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/AppShell";
import { getCatalog } from "@/lib/store";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Catalog lấy phía server: trang chủ render sản phẩm ngay trong HTML đầu
  // tiên, không còn "Đang tải sản phẩm…" 10–15s như bản cũ.
  const catalog = await getCatalog();
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers initialCatalog={catalog}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
