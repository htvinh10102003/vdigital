import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <span
        className={`rounded-2xl bg-gradient-to-br from-brand-500 via-violet-500 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg shadow-brand-600/30 ${
          size === "sm" ? "w-9 h-9 text-lg" : "w-11 h-11 text-2xl"
        }`}
      >
        V
      </span>
      <span className="leading-tight">
        <span className={`block font-black tracking-tight ${size === "sm" ? "text-lg" : "text-[22px]"}`}>
          V<span className="text-brand-400">Digital</span>
        </span>
        <span className="hidden sm:block text-[11px] vd-muted">Tài khoản số giá tốt</span>
      </span>
    </Link>
  );
}
