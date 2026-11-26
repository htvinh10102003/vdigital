/**
 * loading.tsx — màn hình chờ khi chuyển trang/chức năng (kiểu AWSAMELIE):
 * nền trắng, xoay tròn ở giữa. Next.js tự hiện khi điều hướng client-side
 * trong lúc trang đích đang tải phía server. Trang chủ lúc mở đầu dùng
 * splash #vd-boot trong layout (không dùng file này).
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-white text-slate-500"
      role="status"
      aria-label="Đang tải"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-600"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold">Đang tải…</p>
    </div>
  );
}
