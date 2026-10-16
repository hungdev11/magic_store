"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";

export interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  className?: string;
}

// ponytail: single presigned file uploader; upgrade to multi-file parallel upload queue if gallery mode is required.
export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  onRemove,
  label = "Ảnh sản phẩm",
  className = "",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file hình ảnh hợp lệ (.jpg, .png, .webp)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh tối đa là 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const presigned = await api.getPresignedUploadUrl(file.name, file.type);
      await api.uploadToMinIO(presigned.upload_url, file);
      onChange(presigned.file_url);
    } catch (err: any) {
      setError(err?.message || "Lỗi tải ảnh lên");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-text-sub block">{label}</label>}

      <div className="relative">
        {value ? (
          <div className="relative w-32 h-32 rounded-sm border border-border-default overflow-hidden group bg-surface-muted flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (onRemove) onRemove();
                else onChange("");
              }}
              className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
              title="Xóa ảnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 rounded-sm border border-dashed border-border-default hover:border-brand bg-surface-app hover:bg-surface-muted/50 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors p-2 text-center"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
                <span className="text-[11px] text-text-sub font-medium">Đang tải...</span>
              </>
            ) : (
              <>
                <div className="p-2 rounded-sm bg-surface-muted text-text-sub">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-text-sub font-medium">Chọn hoặc kéo ảnh</span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-outflow">{error}</p>}
    </div>
  );
};
