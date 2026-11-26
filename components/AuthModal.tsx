"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isSupabaseConfigured, useAuth } from "./providers";

function strength(pw: string): { label: string; width: string; color: string } {
  if (!pw) return { label: "", width: "0%", color: "bg-slate-500" };
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  if (pw.length < 8 || !hasLetter || !hasNumber)
    return { label: "Yếu — cần tối thiểu 8 ký tự gồm chữ và số", width: "33%", color: "bg-red-500" };
  if (pw.length < 12) return { label: "Trung bình", width: "66%", color: "bg-amber-500" };
  return { label: "Mạnh", width: "100%", color: "bg-emerald-500" };
}

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const s = strength(password);

  // Modal CHỈ đóng khi: bấm nút X, bấm nút Hủy, hoặc bấm phím Esc.
  // Không đóng khi di chuột ra ngoài, không đóng khi click vào vùng tối xung
  // quanh (backdrop không còn onClick nữa — trước đây click vô tình ra ngoài
  // là modal biến mất và dữ liệu đã nhập bị xóa theo).
  // Modal cũng KHÔNG unmount khi đóng (chỉ ẩn bằng `hidden`) nên email/mật
  // khẩu đã gõ vẫn còn nguyên khi mở lại.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) {
      setError("Mật khẩu tối thiểu 8 ký tự, bao gồm chữ và số.");
      return;
    }
    setBusy(true);
    const res =
      mode === "login" ? await auth.signIn(email, password) : await auth.signUp(name, email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 items-center justify-center bg-black/70 p-4 ${open ? "flex" : "hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={mode === "login" ? "Đăng nhập" : "Tạo tài khoản mới"}
    >
      <div className="w-full max-w-md vd-card p-6 shadow-lift">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản mới"}</h2>
            <p className="text-sm vd-muted">
              {mode === "login" ? "Chào mừng bạn trở lại với VDigital" : "Mua nhanh hơn, xem lại đơn đã mua"}
            </p>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs p-3">
            Chế độ demo (chưa cấu hình Supabase): đăng nhập bằng email bất kỳ để thử luồng mua hàng và xem đơn.
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "register" && (
            <div>
              <label className="field-label" htmlFor="auth-name">Họ tên</label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                autoComplete="name"
                className="field"
              />
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              required
              autoComplete="email"
              inputMode="email"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="auth-password">Mật khẩu</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="field"
            />
          </div>
          {mode === "register" && password && (
            <div>
              <div className="h-1.5 rounded-full vd-surface2 overflow-hidden">
                <div className={`h-full ${s.color}`} style={{ width: s.width }} />
              </div>
              <p className="text-xs vd-muted mt-1">{s.label}</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400">{error}</p>}
          <button
            disabled={busy}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
          <button type="button" onClick={onClose} className="btn-outline w-full">
            Hủy
          </button>
        </form>

        <button
          onClick={() => auth.signInGoogle()}
          disabled={!isSupabaseConfigured}
          className="mt-3 w-full rounded-lg border vd-border bg-white text-slate-900 py-2.5 font-semibold text-sm disabled:opacity-40"
        >
          Đăng nhập bằng Google
        </button>
        <p className="mt-4 text-center text-sm vd-muted">
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <button className="text-brand-400 font-semibold" onClick={() => setMode("register")}>
                Đăng ký ngay
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <button className="text-brand-400 font-semibold" onClick={() => setMode("login")}>
                Đăng nhập
              </button>
            </>
          )}
        </p>
        <p className="mt-2 text-center text-xs vd-muted2">
          Bằng việc đăng nhập, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
        </p>
      </div>
    </div>
  );
}
