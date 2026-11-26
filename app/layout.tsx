import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/AppShell";
import { getCatalog } from "@/lib/store";

const inter = Inter({ subsets: ["vietnamese", "latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VDigital — Tài khoản bản quyền số & thẻ game giá tốt",
  description:
    "VDigital — mua tài khoản bản quyền số (ChatGPT, Canva, CapCut, YouTube Premium, Microsoft 365, Gemini Pro, Muse AI) và thẻ game Garena, Zing. Thanh toán VietQR tự động, giao hàng ngay.",
  icons: { icon: "/favicon.svg" },
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
