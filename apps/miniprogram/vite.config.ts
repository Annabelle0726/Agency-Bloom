import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import media from '../../tools/finalize-mp-media.cjs'
import { themeBootstrapScript } from './src/theme-paint'
export default defineConfig({
  plugins: [uni(), {
    name: 'verified-cloud-media-budget',
    apply: 'build',
    enforce: 'post',
    writeBundle: {
      order: 'post', sequential: true,
      handler(output) {
        if (process.env.UNI_PLATFORM === 'mp-weixin' && output.dir) media.finalize(output.dir)
      },
    },
  }, {
    name: 'theme-first-paint',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'script', children: themeBootstrapScript(), injectTo: 'head' }],
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
