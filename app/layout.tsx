import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "VDigital — Tài khoản bản quyền số & thẻ game giá tốt",
  description:
    "VDigital — mua tài khoản bản quyền số (ChatGPT, Canva, CapCut, YouTube Premium, Microsoft 365, Gemini Pro, Muse AI) và thẻ game Garena, Zing. Thanh toán VietQR tự động, giao hàng ngay.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <Header />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
