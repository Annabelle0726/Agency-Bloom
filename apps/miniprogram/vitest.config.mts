import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
// Custom-renderer tests need client render functions in Vitest's Node runtime.
const components = vue()
const transform = components.transform as Function
components.transform = function (code, id) { return transform.call(this, code, id, { ssr: false }) }
export default defineConfig({ plugins: [components], test: { include: ['tests/**/*.test.ts'] } })
