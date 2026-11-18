import { test as teardown } from '@playwright/test';
import { stopBrowserServer } from './browser-server';

teardown('stop the pinned browser', () => stopBrowserServer());
