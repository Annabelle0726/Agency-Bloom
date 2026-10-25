<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import ModalShell from './ModalShell.vue'
import { feedbackOptions } from '../data'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  busy: boolean
  error?: string
  kind: string
  text: string
}>()
const emit = defineEmits<{
  close: []
  save: []
  kindChange: [kind: string]
  textChange: [text: string]
}>()

const placeholder = computed(() => props.kind === 'change'
  ? '现在，你更愿意怎样选择？也可以先记下还不确定的感受'
  : props.kind === 'stuck'
    ? '这次体验让你有什么感受？不用急着找到解决办法'
    : '实际发生了什么？记下一点就好，不必是一项成果')

function onInput(event: Event) {
  emit('textChange', (event as CustomEvent<{ value: string }>).detail.value)
}
</script>

<template>
  <ModalShell title="最近，有什么变化？" :busy="busy" :error="error" @close="emit('close')">
    <text class="page-description">新的发现、疲惫、暂时停下或改变主意，都可以留在这里</text>
    <textarea :value="text" class="text-area" maxlength="2000"
              :placeholder="placeholder" @input="onInput"/>
    <text class="muted small">也可以想想：发生了什么？和想象有什么不同？现在想继续、调整，还是先放一放？</text>
    <view class="chips">
      <button
          v-for="item in feedbackOptions"
          :key="item.id" class="chip" :class="{ selected: kind === item.id }"
          @click="emit('kindChange', item.id)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        {{ item.label }}
      </button>
    </view>
    <button class="primary feedback-submit" :disabled="busy || !text.trim()" :loading="busy" @click="emit('save')"
            hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">留下这次变化
      <SvgIcon name="check" light :size="19"/>
    </button>
  </ModalShell>
</template>
