import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { localized } from '@/i18n/format';
import { cookies } from 'next/headers';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string) {
  const gatewayUrl =
    process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:23100';
  try {
    const res = await fetch(`${gatewayUrl}/api/v1/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json;
  } catch (err) {
    console.error('Fetch product detail failed:', err);
    return null;
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProduct(id);
  const cookieStore = await cookies();
  const locale = (cookieStore.get('bl_locale')?.value ?? 'vi') as 'vi' | 'en';

  if (!product) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-[#2B1E16] font-bold text-base">Không tìm thấy sản phẩm này.</p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-[#4E3427] text-white rounded-xl text-xs font-bold"
        >
          Quay lại thực đơn
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-bold text-[#4E3427] hover:underline"
      >
        ← Quay lại menu
      </Link>

      <ProductDetailClient product={product} locale={locale} />
    </div>
  );
}
