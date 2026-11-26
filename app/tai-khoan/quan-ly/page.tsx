"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, LogOut, Mail, Package, ShieldCheck, User } from "lucide-react";
import { useAuth, useToast } from "@/components/providers";
import { formatDateTime } from "@/lib/format";

/**
 * Quản lý tài khoản — trang RIÊNG (route /tai-khoan/quan-ly).
 * Mọi thao tác tài khoản CHỈ nằm ở đây: thông tin, đổi mật khẩu (nhập mật
 * khẩu hiện tại + mới + xác nhận), phương thức đăng nhập, đăng xuất.
 * Không còn nút đổi mật khẩu ở tab Cài đặt admin hay trang tài khoản chung
 * (/tai-khoan chỉ còn đơn hàng).
 */
export default function AccountManagePage() {
  const auth = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const user = auth.user;
  const providers = user?.providers ?? [];
  const hasEmail = providers.length === 0 || providers.includes("email");
  const hasGoogle = providers.includes("google");

  function openAuth() {
    window.dispatchEvent(new Event("vdigital:open-auth"));
  }

  async function saveName() {
    const n = name.trim();
    if (!n) return;
    setNameMsg("");
    const r = await auth.updateName(n);
    if (r.error) setNameMsg(`Lưu thất bại: ${r.error}`);
    else {
      setNameMsg("Đã lưu tên hiển thị.");
      toast.notify("Đã lưu tên hiển thị.");
      setName("");
    }
  }

  async function changePassword() {
    setPwMsg("");
    if (!pwCur) {
      setPwMsg("Nhập mật khẩu hiện tại.");
      return;
    }
    if (pwNew.length < 8) {
      setPwMsg("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg("Mật khẩu mới và xác nhận không khớp.");
      return;
    }
    setPwBusy(true);
    const r = await auth.changePasswordWithCurrent(pwCur, pwNew);
    setPwBusy(false);
    if (r.error) setPwMsg(`Đổi mật khẩu thất bại: ${r.error}`);
    else {
      setPwMsg("Đã đổi mật khẩu thành công.");
      toast.notify("Đã đổi mật khẩu.");
      setPwCur("");
      setPwNew("");
      setPwConfirm("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 mt-6 pb-10">
      <h1 className="text-2xl font-bold">Quản lý tài khoản</h1>
      <p className="text-sm vd-muted mt-1">
        Thông tin, mật khẩu và phương thức đăng nhập của bạn.{" "}
        <Link href="/tai-khoan?tab=orders" className="font-semibold text-brand-400 hover:underline">
          Xem đơn hàng của tôi
        </Link>
      </p>

      {!user ? (
        <div className="vd-card mt-6 p-6 text-center">
          <p className="vd-muted">Bạn chưa đăng nhập.</p>
          <button onClick={openAuth} className="btn-primary mt-4 !py-2.5 text-sm">
            Đăng nhập / Đăng ký
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Thông tin tài khoản */}
          <section className="vd-card p-5" aria-labelledby="acc-info">
            <h2 id="acc-info" className="flex items-center gap-2 font-bold">
              <User size={18} aria-hidden="true" className="text-brand-400" /> Thông tin tài khoản
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-black text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">{user.name}</p>
                <p className="truncate text-sm vd-muted">{user.email}</p>
                {user.createdAt && <p className="text-xs vd-muted2">Tham gia: {formatDateTime(user.createdAt)}</p>}
              </div>
              {auth.isAdmin && (
                <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-brand-600/20 px-2.5 py-1 text-xs font-bold text-brand-300">
                  <ShieldCheck size={13} aria-hidden="true" /> Admin
                </span>
              )}
            </div>
            {user.isDemo && <p className="mt-3 text-sm text-amber-300">Tài khoản demo (chưa cấu hình Supabase).</p>}
            <div className="mt-4">
              <label className="field-label" htmlFor="display-name">Tên hiển thị</label>
              <div className="flex gap-2">
                <input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={user.name}
                  className="field flex-1"
                  autoComplete="name"
                />
                <button onClick={saveName} disabled={!name.trim()} className="btn-outline !py-2.5 text-sm disabled:opacity-50">
                  Lưu
                </button>
              </div>
              {nameMsg && <p className="mt-2 text-sm vd-muted">{nameMsg}</p>}
            </div>
          </section>

          {/* Đổi mật khẩu */}
          <section className="vd-card p-5" aria-labelledby="acc-password">
            <h2 id="acc-password" className="font-bold">Đổi mật khẩu</h2>
            {hasGoogle && !hasEmail ? (
              <p className="mt-2 text-sm vd-muted">
                Bạn đăng nhập bằng Google nên chưa có mật khẩu. Đặt mật khẩu lần đầu ở form dưới (mật khẩu hiện tại để trống nếu tài khoản chưa có mật khẩu) — hoặc liên kết email ở mục dưới.
              </p>
            ) : (
              <p className="mt-2 text-sm vd-muted">
                {auth.isAdmin
                  ? "Mật khẩu tạm lần đầu rất yếu — đổi ngay sang mật khẩu mạnh (ít nhất 8 ký tự, có chữ + số) sau khi đăng nhập lần đầu."
                  : "Nhập mật khẩu hiện tại để xác nhận, rồi đặt mật khẩu mới (ít nhất 8 ký tự)."}
              </p>
            )}
            <div className="mt-3 space-y-2">
              <div>
                <label className="field-label" htmlFor="pw-current">Mật khẩu hiện tại</label>
                <input id="pw-current" type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} placeholder="Mật khẩu hiện tại" className="field" autoComplete="current-password" />
              </div>
              <div>
                <label className="field-label" htmlFor="pw-new">Mật khẩu mới</label>
                <input id="pw-new" type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Mật khẩu mới (ít nhất 8 ký tự)" className="field" autoComplete="new-password" />
              </div>
              <div>
                <label className="field-label" htmlFor="pw-confirm">Xác nhận mật khẩu mới</label>
                <input id="pw-confirm" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="field" autoComplete="new-password" />
              </div>
              <button onClick={changePassword} disabled={pwBusy} className="btn-primary !py-2.5 text-sm disabled:opacity-50">
                {pwBusy ? "Đang đổi…" : "Đổi mật khẩu"}
              </button>
              {pwMsg && (
                <p role="alert" className="text-sm text-red-400">
                  {pwMsg}
                </p>
              )}
            </div>
          </section>

          {/* Phương thức đăng nhập */}
          <section className="vd-card p-5" aria-labelledby="acc-methods">
            <h2 id="acc-methods" className="font-bold">Phương thức đăng nhập</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2 rounded-lg vd-surface2 px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <Mail size={16} aria-hidden="true" className="vd-muted" /> Email &amp; mật khẩu
                </span>
                {hasEmail ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <Check size={15} aria-hidden="true" /> Đã liên kết
                  </span>
                ) : (
                  <span className="vd-muted">Chưa dùng</span>
                )}
              </li>
              <li className="flex items-center justify-between gap-2 rounded-lg vd-surface2 px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-900">G</span>
                  Đăng nhập bằng Google
                </span>
                {hasGoogle ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <Check size={15} aria-hidden="true" /> Đã liên kết
                  </span>
                ) : (
                  <button onClick={() => void auth.signInGoogle()} className="btn-outline !py-1.5 !px-3 text-xs">
                    Liên kết Google
                  </button>
                )}
              </li>
            </ul>
            <p className="mt-2 text-xs vd-muted2">Đăng nhập bằng Google dùng tài khoản Google của bạn — VDigital không lưu mật khẩu Google.</p>
          </section>

          {/* Đơn hàng + đăng xuất */}
          <section className="vd-card p-5" aria-labelledby="acc-actions">
            <h2 id="acc-actions" className="font-bold">Đơn hàng &amp; phiên đăng nhập</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/tai-khoan?tab=orders" className="btn-outline !py-2.5 text-sm">
                <Package size={16} aria-hidden="true" className="mr-1.5 inline" /> Đơn hàng của tôi
              </Link>
              <button
                onClick={() => void auth.signOut()}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-red-500/60 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={16} aria-hidden="true" /> Đăng xuất
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
