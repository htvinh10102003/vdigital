"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { isSupabaseConfigured, useAuth } from "./providers";

function strength(pw: string): { label: string; width: string; color: string } {
  if (!pw) return { label: "", width: "0%", color: "bg-navy-600" };
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-navy-800 border border-navy-600 p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản mới"}</h2>
            <p className="text-sm text-slate-400">
              {mode === "login" ? "Chào mừng bạn trở lại với VDigital" : "Mua nhanh hơn, xem lại đơn đã mua"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-navy-700" aria-label="Đóng">
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ tên"
              required
              className="w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2.5 text-sm"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            required
            className="w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            required
            className="w-full rounded-lg bg-navy-900 border border-navy-600 px-3 py-2.5 text-sm"
          />
          {mode === "register" && password && (
            <div>
              <div className="h-1.5 rounded-full bg-navy-700 overflow-hidden">
                <div className={`h-full ${s.color}`} style={{ width: s.width }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>

        <button
          onClick={() => auth.signInGoogle()}
          disabled={!isSupabaseConfigured}
          className="mt-3 w-full rounded-lg border border-navy-600 bg-white text-slate-900 py-2.5 font-semibold text-sm disabled:opacity-40"
        >
          Đăng nhập bằng Google
        </button>
        {!isSupabaseConfigured && (
          <button
            onClick={() => {
              if (!email.includes("@")) {
                setError("Nhập email để vào demo.");
                return;
              }
              auth.demoSignIn(email);
              onClose();
            }}
            className="mt-3 w-full rounded-lg border border-amber-500/60 text-amber-300 py-2.5 font-semibold text-sm"
          >
            Vào demo bằng email trên
          </button>
        )}
        <p className="mt-4 text-center text-sm text-slate-400">
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
        <p className="mt-2 text-center text-xs text-slate-500">
          Bằng việc đăng nhập, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
        </p>
      </div>
    </div>
  );
}
