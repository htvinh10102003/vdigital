import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-navy-700 bg-navy-950">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <Logo size="sm" />
          <p className="mt-3 text-slate-400 leading-relaxed">
            Chuyên cung cấp tài khoản bản quyền số và thẻ game chính hãng, giao hàng nhanh, bảo hành uy tín.
          </p>
        </div>
        <div>
          <h4 className="font-bold mb-3">Sản phẩm</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/tai-khoan-ban-quyen" className="hover:text-white">Tài khoản bản quyền</Link></li>
            <li><Link href="/the-game" className="hover:text-white">Thẻ game</Link></li>
            <li><Link href="/khuyen-mai" className="hover:text-white">Khuyến mãi</Link></li>
            <li><Link href="/ban-chay" className="hover:text-white">Bán chạy</Link></li>
            <li><Link href="/san-pham" className="hover:text-white">Tất cả sản phẩm</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-3">Hỗ trợ</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/huong-dan" className="hover:text-white">Hướng dẫn mua hàng</Link></li>
            <li><Link href="/#faq" className="hover:text-white">Câu hỏi thường gặp</Link></li>
            <li><Link href="/dieu-khoan" className="hover:text-white">Điều khoản sử dụng</Link></li>
            <li><Link href="/bao-mat" className="hover:text-white">Chính sách bảo mật</Link></li>
            <li><Link href="/bao-hanh" className="hover:text-white">Chính sách bảo hành</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-3">Tài khoản</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/tai-khoan" className="hover:text-white">Quản lý tài khoản</Link></li>
            <li><Link href="/tai-khoan?tab=orders" className="hover:text-white">Đơn hàng của tôi</Link></li>
            <li><Link href="/gio-hang" className="hover:text-white">Giỏ hàng</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-3">Liên hệ</h4>
          <ul className="space-y-2 text-slate-400">
            <li>Thanh toán: VietQR — MB Bank</li>
            <li>Email: hotro@vdigital.vn</li>
            <li>Zalo / Messenger: góc phải màn hình</li>
            <li>Hỗ trợ 24/7</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} VDigital. Tất cả quyền được bảo lưu.
      </div>
    </footer>
  );
}
