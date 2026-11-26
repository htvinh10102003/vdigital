export default function BaoMatPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 mt-8">
      <h1 className="text-2xl font-bold">Chính sách bảo mật</h1>
      <div className="mt-4 space-y-3 text-slate-300 leading-relaxed text-sm">
        <p>1. VDigital chỉ thu thập họ tên, email và số điện thoại phục vụ việc giao hàng và hỗ trợ đơn hàng.</p>
        <p>2. Thông tin tài khoản / mã thẻ chỉ hiển thị cho chủ đơn hàng sau khi đã thanh toán.</p>
        <p>3. Shop không bán, không chia sẻ thông tin khách hàng cho bên thứ ba, trừ khi pháp luật yêu cầu.</p>
        <p>4. Mật khẩu tài khoản khách đăng ký được lưu trữ bởi hệ thống xác thực (Supabase Auth), shop không xem được mật khẩu của bạn.</p>
      </div>
    </div>
  );
}
