import type { MetadataRoute } from 'next';
import tokens from '@/styles/tokens.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrewLite',
    short_name: 'BrewLite',
    start_url: '/',
    display: 'standalone',
    theme_color: tokens.color.primary.$value,
    background_color: tokens.color['base-100'].$value,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
