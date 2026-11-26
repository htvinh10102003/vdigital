import { NextResponse } from "next/server";
import { listPublicVouchers } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/** Voucher công khai để gợi ý ở checkout — chỉ trả các trường khách cần thấy. */
export async function GET() {
  const vouchers = await listPublicVouchers(10);
  return NextResponse.json({
    vouchers: vouchers.map((v) => ({
      code: v.code,
      type: v.type,
      value: v.value,
      min_order: v.min_order,
      expires_at: v.expires_at,
    })),
  });
}
