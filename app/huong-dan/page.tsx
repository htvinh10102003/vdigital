export default function HuongDanPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 mt-8 prose-invert">
      <h1 className="text-2xl font-bold">Hướng dẫn mua hàng</h1>
      <ol className="list-decimal ml-5 mt-4 space-y-3 text-slate-300 leading-relaxed">
        <li><b className="text-white">Chọn sản phẩm &amp; gói phù hợp:</b> kiểm tra giá, thời hạn và chính sách bảo hành trước khi mua.</li>
        <li><b className="text-white">Xác nhận đơn &amp; thanh toán:</b> nhập họ tên và email nhận hàng, quét mã VietQR qua PayOS. Hệ thống tự xác nhận trong vài giây — không thu phí giao dịch.</li>
        <li><b className="text-white">Nhận tài khoản ngay:</b> sản phẩm giao tự động hiện ngay trong chi tiết đơn hàng và email. Sản phẩm làm tay (nâng cấp chính chủ, add Family) và thẻ game sẽ được shop xử lý trong 5–30 phút.</li>
        <li><b className="text-white">Xem lại đơn đã mua:</b> vào mục Tài khoản → Đơn hàng của tôi, hoặc tra bằng mã đơn.</li>
      </ol>
      <p className="text-slate-400 mt-4 text-sm">Cần hỗ trợ? Liên hệ shop qua Zalo / Messenger hoặc email hotro@vdigital.vn, gửi kèm mã đơn để được hỗ trợ nhanh.</p>
    </div>
  );
}
