import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { themeBootstrapScript } from './src/theme-paint'
export default defineConfig({
  plugins: [uni(), {
    name: 'theme-first-paint',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'script', children: themeBootstrapScript(), injectTo: 'head' }],
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
