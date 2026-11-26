import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/AppShell";
import { getCatalog } from "@/lib/store";

/**
 * Typography v4 — chuyên nghiệp, hỗ trợ tốt tiếng Việt có dấu:
 * - Be Vietnam Pro (thiết kế riêng cho tiếng Việt): tiêu đề/UI, giá, nút.
 * - Inter: nội dung, mô tả, nhãn nhỏ.
 * Cả hai đều qua next/font/google với subset vietnamese.
 */
const inter = Inter({ subsets: ["vietnamese", "latin"], variable: "--font-inter" });
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
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
      <body className={`${inter.variable} ${beVietnamPro.variable}`}>
        <Providers initialCatalog={catalog}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
