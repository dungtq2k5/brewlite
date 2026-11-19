import { test as setup } from '@playwright/test';
import { adminToken, api } from '../support';
import { browserImage, startBrowserServer } from './browser-server';

setup(`start the pinned browser (${browserImage()})`, async () => {
  setup.setTimeout(180_000); // a first run pulls the image
  await startBrowserServer();
});

// A run of the admin specs cut short leaves its `e2e-<run>-…` products and categories live, and the
// menu rows would draw them. Soft-deleted here, as that spec's own clean-up does.
setup('clear menu rows left by an interrupted admin run', async () => {
  const token = await adminToken();
  for (const path of ['/admin/products', '/admin/categories']) {
    const { body } = await api<{ data: { id: string; name: { en: string } }[] }>(
      `${path}${path.endsWith('products') ? '?pageSize=100' : ''}`,
      { token },
    );
    for (const row of body.data.filter((r) => r.name.en.startsWith('e2e-')))
      await api(`${path}/${row.id}`, { method: 'DELETE', token });
  }
});
