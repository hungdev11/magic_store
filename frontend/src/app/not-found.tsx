import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <h2 className="text-2xl font-bold text-text-main">404 - Không tìm thấy trang</h2>
      <p className="text-sm text-text-sub">Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-hover transition"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
