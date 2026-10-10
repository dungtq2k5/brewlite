import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-3xl shadow-md">
        📶
      </div>
      <h1 className="font-extrabold text-lg text-neutral">Bạn đang ngoại tuyến</h1>
      <p className="text-xs text-neutral/70 max-w-xs">
        Giỏ hàng của bạn vẫn được lưu an toàn trên thiết bị này. Vui lòng kiểm tra lại kết nối mạng.
      </p>
      <Link href="/" className="btn btn-primary btn-sm text-white px-6 font-bold">
        Thử lại
      </Link>
    </div>
  );
}
