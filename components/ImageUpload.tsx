"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

/**
 * Upload ảnh cho admin: kéo-thả hoặc chọn file, xem trước, xóa/thay.
 * Ảnh được nén/resize phía client về WebP trước khi up:
 * - sản phẩm: tối đa 800×800
 * - banner: tối đa 1200×600
 * - danh mục: tối đa 400×400
 * File up lên Supabase Storage (bucket vdigital-media), URL lưu vào DB —
 * không lưu base64 vào DB, không commit ảnh vào repo.
 */

export function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh"))), "image/webp", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File không phải ảnh hợp lệ"));
    };
    img.src = url;
  });
}

export function ImageUpload({
  value,
  onChange,
  kind,
  label,
  ratio = "aspect-square",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: "products" | "banners" | "categories";
  label: string;
  ratio?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const [maxW, maxH] = kind === "banners" ? [1200, 600] : kind === "categories" ? [400, 400] : [800, 800];
      const blob = await resizeImage(file, maxW, maxH);
      const form = new FormData();
      form.append("file", new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      form.append("kind", kind);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Up ảnh thất bại");
      onChange(data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Up ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className={`relative ${ratio} max-w-xs overflow-hidden rounded-xl border vd-border`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-black/60 p-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="flex-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">
              Thay ảnh
            </button>
            <button type="button" onClick={() => onChange(null)} className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white" aria-label="Xoá ảnh">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex w-full max-w-xs ${ratio} flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed vd-border vd-muted hover:border-brand-500 hover:text-brand-400 disabled:opacity-50`}
        >
          {uploading ? <Loader2 size={26} className="animate-spin" /> : <ImagePlus size={26} />}
          <span className="text-xs font-semibold">{uploading ? "Đang up ảnh…" : "Kéo-thả hoặc bấm để chọn ảnh"}</span>
          <span className="text-[11px] vd-muted2">
            {kind === "banners" ? "Khuyến nghị 1200×600" : kind === "categories" ? "Khuyến nghị 400×400" : "Khuyến nghị 800×800"} · tự nén về WebP
          </span>
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
      {value && <p className="field-hint break-all">URL: {value}</p>}
    </div>
  );
}
