import { buildDeliveryEmail, sendMail } from "./email";
import { findVariant } from "./seed";
import { findVariantInCatalog, getCatalog } from "./store";
import { getOrderByCode, takeStockCode, updateOrder } from "./store";
import { getSupabaseServer } from "./supabase";
import { notifyOrderDelivered, notifyOrderPaid } from "./notifications";
import { recordVoucherUsage } from "./vouchers";
import type { Order } from "./types";

/**
 * Giao hàng sau khi PayOS xác nhận đã thanh toán.
 * - auto: lấy mã cũ nhất chưa dùng trong kho, giao ngay.
 * - manual: đơn chuyển "Chờ xử lý" để admin làm tay (add Family / nâng cấp chính chủ).
 * - game_card: đơn chuyển "Chờ xử lý" — admin điền serial + mã trong /admin rồi bấm "Giao + gửi mail".
 * Mail lỗi cũng không làm hỏng đơn — chỉ log (xem lib/email.ts).
 */

function orderStatusAfter(order: Order): Order["status"] {
  const items = order.items;
  if (items.length && items.every((i) => i.status === "delivered")) return "completed";
  if (items.some((i) => i.status === "waiting_manual" || i.status === "failed")) return "processing";
  return "paid";
}

export async function fulfillPaidOrder(order: Order): Promise<Order> {
  const emailLines: { label: string; value: string }[] = [];
  let guide = "";
  let warranty = 30;
  const catalog = await getCatalog();

  for (const item of order.items) {
    if (item.status !== "pending") continue;
    const found = findVariantInCatalog(catalog, item.variant_id) ?? findVariant(item.variant_id);
    if (found) {
      guide = found.product.guide;
      warranty = found.product.warranty_days;
    }
    if (item.fulfillment_type === "link") {
      // Giao link/key theo mẫu admin đặt (có thể chứa {code}); không có mẫu thì lấy mã kho nếu có.
      const template = found?.variant.delivery_template?.trim();
      const stock = template ? null : await takeStockCode(item.variant_id, order.id);
      const delivered = template
        ? template.replaceAll("{code}", stock?.code ?? "")
        : stock?.code ?? "";
      if (delivered) {
        item.status = "delivered";
        item.delivered_code = delivered;
        item.delivered_note = found?.variant.delivery_note ?? null;
        emailLines.push({ label: `${item.product_name} — ${item.variant_name}`, value: delivered });
      } else {
        item.status = "failed";
        item.delivered_note = "Chưa có link/key để giao — admin cần bổ sung mẫu giao hàng.";
      }
    } else if (item.fulfillment_type === "auto") {
      const stock = await takeStockCode(item.variant_id, order.id);
      if (stock) {
        item.status = "delivered";
        item.delivered_code = stock.code;
        emailLines.push({ label: `${item.product_name} — ${item.variant_name}`, value: stock.code });
      } else {
        item.status = "failed";
        item.delivered_note = "Hết mã trong kho — admin cần bổ sung mã rồi giao tay.";
      }
    } else {
      // manual + game_card: chờ admin xử lý
      item.status = "waiting_manual";
    }
  }

  order.status = orderStatusAfter(order);
  await updateOrder(order);

  // Voucher chỉ ghi nhận đã dùng khi đơn ĐÃ TRẢ TIỀN (tới được đây).
  if (order.voucher_code) {
    await recordVoucherUsage({
      voucherCode: order.voucher_code,
      userId: order.user_id,
      customerEmail: order.customer_email,
      orderCode: order.code,
    });
  }

  // Thông báo cho khách (best-effort, không làm hỏng giao hàng nếu lỗi):
  // trả tiền xong luôn báo 1 cái; giao hết thì báo thêm 1 cái "đã giao".
  await notifyOrderPaid(order);
  if (order.status === "completed") await notifyOrderDelivered(order);

  // Gửi mail giao hàng cho phần đã giao tự động (nếu có). Phần làm tay sẽ
  // gửi mail riêng khi admin hoàn thành. Mẫu mail lấy từ bảng
  // email_templates (admin chỉnh trong /admin > Mẫu email) hoặc mẫu mặc định.
  if (emailLines.length > 0) {
    const firstDelivered = order.items.find((i) => i.status === "delivered");
    const mail = await buildDeliveryEmail(getSupabaseServer(), {
      type: firstDelivered?.fulfillment_type === "link" ? "link" : "auto",
      productId: firstDelivered?.product_id ?? null,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      orderCode: order.code,
      productName: order.items.map((i) => i.product_name).join(", "),
      variantName: order.items.map((i) => i.variant_name).join(", "),
      lines: emailLines,
      code: firstDelivered?.delivered_code ?? undefined,
      deliveryLink: firstDelivered?.delivered_code ?? undefined,
      guide,
      warrantyDays: warranty,
    });
    await sendMail({ to: order.customer_email, subject: mail.subject, html: mail.html });
  }
  return order;
}

/** Admin giao thẻ game: điền serial + mã, mệnh giá tự lấy theo gói (cho sửa). */
export async function deliverGameCard(
  orderCode: string,
  itemId: string,
  input: { serial: string; pin: string; denomination: string; note?: string },
): Promise<Order> {
  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Không tìm thấy sản phẩm trong đơn");
  if (item.fulfillment_type !== "game_card") throw new Error("Sản phẩm này không phải thẻ game");

  item.status = "delivered";
  item.delivered_serial = input.serial.trim();
  item.delivered_pin = input.pin.trim();
  item.delivered_note = input.note?.trim() || null;
  order.status = orderStatusAfter(order);
  await updateOrder(order);

  const found = findVariantInCatalog(await getCatalog(), item.variant_id) ?? findVariant(item.variant_id);
  const mail = await buildDeliveryEmail(getSupabaseServer(), {
    type: "game_card",
    productId: item.product_id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    orderCode: order.code,
    productName: item.product_name,
    variantName: item.variant_name,
    lines: [
      { label: "Serial thẻ", value: input.serial.trim() },
      { label: "Mã nạp", value: input.pin.trim() },
      { label: "Mệnh giá", value: input.denomination },
    ],
    serial: input.serial.trim(),
    pin: input.pin.trim(),
    note: input.note?.trim() || undefined,
    guide: found?.product.guide ?? "",
    warrantyDays: found?.product.warranty_days ?? 7,
  });
  await sendMail({ to: order.customer_email, subject: mail.subject, html: mail.html });
  return order;
}

/** Admin hoàn thành đơn làm tay (đã add Family / nâng cấp chính chủ xong). */
export async function completeManualItem(
  orderCode: string,
  itemId: string,
  note: string,
): Promise<Order> {
  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Không tìm thấy sản phẩm trong đơn");

  item.status = "delivered";
  item.delivered_note = note.trim() || "Đã nâng cấp / thêm vào Family xong.";
  order.status = orderStatusAfter(order);
  await updateOrder(order);

  const found = findVariantInCatalog(await getCatalog(), item.variant_id) ?? findVariant(item.variant_id);
  // Gửi kèm thông tin khách đã điền theo manual_fields (vd email cần add
  // Family) để khách đối chiếu lại — hiện nhãn thật của ô, không hiện id.
  const fieldLabel = new Map((found?.variant.manual_fields ?? []).map((f) => [f.id, f.label]));
  const customerInfoLines = Object.entries(item.customer_info ?? {})
    .filter(([, v]) => String(v ?? "").trim())
    .map(([k, v]) => ({ label: fieldLabel.get(k) ?? k, value: String(v) }));
  const mail = await buildDeliveryEmail(getSupabaseServer(), {
    type: "manual",
    productId: item.product_id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    orderCode: order.code,
    productName: item.product_name,
    variantName: item.variant_name,
    lines: [
      { label: "Trạng thái", value: item.delivered_note },
      ...customerInfoLines,
    ],
    note: note.trim() || undefined,
    guide: found?.product.guide ?? "",
    warrantyDays: found?.product.warranty_days ?? 30,
  });
  await sendMail({ to: order.customer_email, subject: mail.subject, html: mail.html });
  return order;
}
