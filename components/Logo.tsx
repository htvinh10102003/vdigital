import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span
        className={`rounded-xl bg-gradient-to-br from-blue-600 to-brand-500 flex items-center justify-center font-black text-white ${
          size === "sm" ? "w-8 h-8 text-lg" : "w-10 h-10 text-2xl"
        }`}
      >
        V
      </span>
      <span className="leading-tight">
        <span className={`block font-black tracking-tight text-white ${size === "sm" ? "text-lg" : "text-2xl"}`}>
          V<span className="text-brand-500">Digital</span>
        </span>
        <span className="hidden sm:block text-[11px] text-slate-400">Tài khoản số giá tốt</span>
      </span>
    </Link>
  );
}
