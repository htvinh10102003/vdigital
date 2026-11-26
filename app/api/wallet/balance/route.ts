import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { getWalletBalance, listWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** Số dư Xu + lịch sử ví của chính khách đang đăng nhập. */
export async function GET(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  const { balance } = await getWalletBalance(user.id, user.email);
  const transactions = await listWalletTransactions(user.id, user.email, 50);
  return NextResponse.json({ balance, transactions });
}
