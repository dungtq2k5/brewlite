import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelBody, PanelHead } from '@/components/vellum/Panel';
import { getLocale } from '@/i18n/locale.server';

export default async function CreditsPage() {
  const locale = await getLocale();
  const isVi = locale === 'vi';

  return (
    <div>
      <PageHead
        title={isVi ? 'Nguồn ảnh & ghi công' : 'Image credits'}
        meta={isVi ? 'Ảnh món và phông chữ' : 'Item photos and typefaces'}
        lede={
          isVi
            ? 'Ảnh món do quán tải lên. Món chưa có ảnh dùng hình minh hoạ theo nhóm món của BrewLite.'
            : 'Item photos are uploaded by the shop. Items without a photo use a BrewLite category illustration.'
        }
      />

      <div className="stack--lg">
        <Panel>
          <PanelHead title={isVi ? 'Ảnh món' : 'Item photos'} />
          <PanelBody>
            <p>
              {isVi
                ? 'Ảnh món được tải lên trong trang quản trị và hiển thị trên thực đơn, trang món và giỏ hàng. Hình minh hoạ theo nhóm món do BrewLite vẽ, không phải ảnh món tại quán.'
                : 'Item photos are uploaded in the admin console and appear on the menu, item page and cart. Category illustrations are drawn by BrewLite and are not photos of an in-store item.'}
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={isVi ? 'Phông chữ' : 'Typefaces'} />
          <PanelBody>
            <p>
              Grenze, Grenze Gotisch, Hanken Grotesk —{' '}
              <a
                className="text-link"
                href="https://fonts.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Google Fonts
              </a>
              , {isVi ? 'giấy phép' : 'licensed under the'}{' '}
              <a
                className="text-link"
                href="https://openfontlicense.org/"
                target="_blank"
                rel="noreferrer"
              >
                SIL Open Font License 1.1
              </a>
              .
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
