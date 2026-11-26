import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/track — ghi 1 lượt xem trang (page view) vào Supabase.
 * Chỉ lưu đường dẫn (path), không lưu IP, không lưu thông tin cá nhân.
 * Bảng page_views do migration 006 tạo (Vinh chạy trong SQL Editor).
 * Nếu bảng chưa có / chưa cấu hình Supabase thì bỏ qua lặng lẽ —
 * không được làm chậm hay hỏng trang.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = String(body.path ?? "").slice(0, 200);
    if (!path.startsWith("/")) return NextResponse.json({ ok: true });
    const sb = getSupabaseServer();
    if (!sb || !isSupabaseConfigured) return NextResponse.json({ ok: true });
    await sb.from("page_views").insert({ path });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
