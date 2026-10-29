import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelBody } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';

export default function StaffStockPage() {
  return (
    <div>
      <PageHead
        title="Kho & món"
        meta="Tồn kho và topping"
        lede="Màn hình này chờ quyết định về nguồn danh sách topping cho Staff."
        actions={<Tag tone="muted">Chờ chốt</Tag>}
      />

      <Notice tone="warning">
        <strong>Chưa nối dữ liệu.</strong> Gateway hiện chỉ có endpoint đổi trạng thái topping,
        không có endpoint đọc danh sách topping cho Staff. Phase 0 không tự bịa danh sách.
      </Notice>

      <Panel className="stack">
        <PanelBody>
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-lg)' }}>
            Cần một quyết định trước khi port
          </h2>
          <ul
            style={{
              marginTop: 'var(--space-sm)',
              paddingLeft: '1.2em',
              color: 'var(--color-muted)',
            }}
          >
            <li>Ẩn mục topping với STAFF và chỉ mở trong ADMIN.</li>
            <li>Dùng danh sách seed cố định — không khuyến nghị vì sẽ lệch dữ liệu thật.</li>
            <li>
              Thêm endpoint <code>GET /staff/toppings</code> — ngoài phạm vi Phase 0.
            </li>
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
