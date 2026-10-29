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
        meta={isVi ? 'Ảnh minh hoạ và phông chữ' : 'Illustrations and typefaces'}
        lede={
          isVi
            ? 'BrewLite dùng một số ảnh minh hoạ có giấy phép mở. Chi tiết tác giả, giấy phép và nguồn ở bên dưới.'
            : 'BrewLite uses a small set of openly licensed illustrations. Authors, licences and sources are listed below.'
        }
      />

      <div className="stack--lg">
        <Panel>
          <PanelHead title={isVi ? 'Ảnh trên thực đơn' : 'Menu illustration'} />
          <PanelBody>
            <dl className="kv">
              <div className="kv-row">
                <dt>{isVi ? 'Tác phẩm' : 'Work'}</dt>
                <dd>Espresso coffee pouring from retro espresso machine</dd>
              </div>
              <div className="kv-row">
                <dt>{isVi ? 'Tác giả' : 'Author'}</dt>
                <dd>Shixart1985</dd>
              </div>
              <div className="kv-row">
                <dt>{isVi ? 'Giấy phép' : 'Licence'}</dt>
                <dd>
                  <a
                    className="text-link"
                    href="https://creativecommons.org/licenses/by/2.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Creative Commons Attribution 2.0 (CC BY 2.0)
                  </a>
                </dd>
              </div>
              <div className="kv-row">
                <dt>{isVi ? 'Nguồn' : 'Source'}</dt>
                <dd>
                  <a
                    className="text-link"
                    href="https://commons.wikimedia.org/wiki/File:Espresso_coffee_pouring_from_retro_espresso_machine.jpg"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Wikimedia Commons
                  </a>
                </dd>
              </div>
              <div className="kv-row">
                <dt>{isVi ? 'Sử dụng' : 'Use'}</dt>
                <dd>
                  {isVi
                    ? 'Ảnh minh hoạ cạnh thực đơn. Đây không phải ảnh món tại quán.'
                    : 'Illustration beside the menu. It is not a photo of an in-store item.'}
                </dd>
              </div>
            </dl>
            <p className="fine" style={{ marginTop: 'var(--space-md)' }}>
              {isVi
                ? 'Ảnh món do quán tải lên sẽ hiển thị tại trang món tương ứng.'
                : 'Photos uploaded by the shop appear on the matching item page.'}
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
