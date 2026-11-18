import { test as setup } from '@playwright/test';
import { browserImage, startBrowserServer } from './browser-server';

setup(`start the pinned browser (${browserImage()})`, async () => {
  setup.setTimeout(180_000); // a first run pulls the image
  await startBrowserServer();
});
