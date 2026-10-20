<script setup lang="ts">
import ActionButton from '../../../components/ActionButton.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import ThemePreview from '../../../components/ThemePreview.vue'
import ModalShell from './ModalShell.vue'
import type { ThemeDefinition, ThemeId } from '../../../themes'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  themes: ThemeDefinition[]
  activeTheme: ThemeDefinition
  applyingTheme: ThemeId | null
  busy: boolean
  error?: string
}>()
const emit = defineEmits<{ close: []; select: [theme: ThemeId] }>()
</script>

<template>
  <ModalShell title="选择舒服的光线" :busy="busy" :error="error" appearance @close="emit('close')">
    <text class="page-description">换一种氛围，继续做你自己</text>
    <view class="theme-grid">
      <button v-for="theme in themes" :key="theme.id" class="theme-card" :data-theme="theme.id"
              :aria-label="'使用' + theme.name + '主题'" :aria-pressed="activeTheme.id === theme.id"
              :class="{ chosen: activeTheme.id === theme.id }" :disabled="busy || !!applyingTheme"
              @click="emit('select', theme.id)" hover-class="theme-pressed" :hover-start-time="0" :hover-stay-time="70">
        <ThemePreview :theme="theme" />
        <view class="theme-copy" :style="{ background: theme.palette.paper, color: theme.palette.ink }">
          <view class="theme-name-row"><text>{{ theme.name }}</text><view class="theme-swatches"><view v-for="color in [theme.palette.bg, theme.palette.soft, theme.palette.fill]" :key="color" :style="{ background: color }"/></view></view>
          <text class="theme-english" :style="{ color: theme.palette.muted }">{{ theme.english }}{{ theme.id === 'light' ? ' · 默认' : '' }}</text>
          <text class="theme-detail" :style="{ color: theme.palette.muted }">{{ theme.detail }}</text>
        </view>
        <view v-if="activeTheme.id === theme.id" class="theme-check"><SvgIcon name="check" light :size="15"/></view>
        <view v-if="applyingTheme === theme.id" class="theme-applying">正在应用</view>
      </button>
    </view>
    <template #footer>
      <view class="appearance-footer"><ActionButton :arrow="false" :disabled="busy" @click="emit('close')">完成</ActionButton></view>
    </template>
  </ModalShell>
</template>
