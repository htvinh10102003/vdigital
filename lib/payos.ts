import crypto from "crypto";

/**
 * PayOS — VietQR tự động.
 * - Tạo link thanh toán: POST https://api-merchant.payos.vn/v2/payment-requests
 *   với chữ ký HMAC-SHA256(checksumKey, "amount=...&cancelUrl=...&description=...&orderCode=...&returnUrl=...")
 *   (các key sắp xếp theo alphabet, nối key=value bằng &).
 * - Webhook: PayOS gửi { code, desc, success, data, signature }. Chữ ký được
 *   tạo y hệt từ object `data` (key sắp xếp alphabet). PHẢI verify trước khi
 *   đánh dấu đơn đã thanh toán — không bao giờ tin body chưa verify.
 * - PayOS miễn phí, 0% / giao dịch, tiền về thẳng tài khoản ngân hàng đã liên
 *   kết (ở đây là MB Bank). Xem README để đăng ký.
 */

export const isPayosConfigured = Boolean(
  process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY,
);

export function createSignatureFromObj(obj: Record<string, unknown>, checksumKey: string): string {
  const sortedKeys = Object.keys(obj).sort();
  const data = sortedKeys.map((k) => `${k}=${obj[k]}`).join("&");
  return crypto.createHmac("sha256", checksumKey).update(data).digest("hex");
}

export function verifyPayosSignature(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string,
): boolean {
  if (!data || !signature || !checksumKey) return false;
  const expected = createSignatureFromObj(data, checksumKey);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface PayosPaymentRequest {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

export interface PayosPaymentResult {
  checkoutUrl: string;
  qrCode: string;
  paymentLinkId: string;
  orderCode: number;
  amount: number;
}

export async function createPayosPayment(req: PayosPaymentRequest): Promise<PayosPaymentResult> {
  const clientId = process.env.PAYOS_CLIENT_ID!;
  const apiKey = process.env.PAYOS_API_KEY!;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY!;

  const signature = createSignatureFromObj(
    {
      amount: req.amount,
      cancelUrl: req.cancelUrl,
      description: req.description,
      orderCode: req.orderCode,
      returnUrl: req.returnUrl,
    },
    checksumKey,
  );

  const res = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ ...req, signature }),
  });
  const json = await res.json();
  if (!res.ok || json?.code !== "00" || !json?.data) {
    throw new Error(`PayOS tạo link thanh toán thất bại: ${json?.desc || res.statusText}`);
  }
  return {
    checkoutUrl: json.data.checkoutUrl,
    qrCode: json.data.qrCode,
    paymentLinkId: json.data.paymentLinkId,
    orderCode: json.data.orderCode,
    amount: json.data.amount,
  };
}
