import { ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';

export default function AdminOrdersPage() {
  return (
    <>
      <PageHead
        title="Đơn hàng"
        meta="Dùng bảng đơn của Staff"
        lede="Danh sách đơn toàn hệ thống chưa được bật. Vận hành tại quầy dùng bảng đơn Staff, nơi có đủ đơn đang pha và đơn đã hoàn tất."
        actions={<ButtonLink href="/staff">Mở bảng đơn Staff</ButtonLink>}
      />

      <Panel>
        <div className="panel-body">
          <EmptyState
            title="Chưa có danh sách đơn riêng cho admin"
            action={<ButtonLink href="/staff">Mở bảng đơn Staff</ButtonLink>}
          >
            Bảng đơn Staff hiển thị đơn đang chờ pha, đang pha và chờ khách nhận. Đơn hoàn tất hoặc
            đã hủy tự rời bảng.
          </EmptyState>
        </div>
      </Panel>
    </>
  );
}
