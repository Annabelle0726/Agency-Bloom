<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { iconSources } from '../../../icons'
import { supportStyles } from '../../../onboarding'
import type { ChatEntry } from '../../../chat-entry'
import type { Conversation } from '../../../domain'
import type { ConversationMenuAction } from '../../../conversation-action'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  sending: boolean
  activeConversation: Conversation | null
  isDrafting: boolean
  chatEntry: ChatEntry
  runningIds: string[]
  chatMenuOpen: boolean
  readOnlyConversation: boolean
  selectedMode: string
}>()
const emit = defineEmits<{
  back: []
  history: []
  toggleMenu: []
  menuAction: [action: ConversationMenuAction]
}>()
</script>

<template>
  <view class="chat-header header-chrome">
    <button class="chat-header-button" aria-label="打开会话列表" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70" @click="emit('history')">
      <image class="chat-header-glyph" :src="iconSources.menu.ink" mode="aspectFit" aria-hidden="true" />
    </button>
    <button class="chat-header-title" :class="{ 'is-open': chatMenuOpen }" :disabled="busy"
            :aria-expanded="chatMenuOpen" aria-haspopup="menu" aria-label="管理当前会话"
            hover-class="header-title-pressed" :hover-start-time="0" :hover-stay-time="70" @click="emit('toggleMenu')">
      <text class="chat-header-name">{{ isDrafting ? '新会话' : activeConversation?.title || chatEntry.heading }}</text>
      <view class="chat-header-chevron"><SvgIcon name="chevron" :size="13"/></view>
    </button>
    <view class="chat-header-right">
      <view v-if="runningIds.length" class="chat-header-running" aria-label="有回复正在生成">◌</view>
      <button class="chat-header-button" aria-label="返回主界面" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70" @click="emit('back')">
        <image class="chat-header-glyph" :src="iconSources.home.ink" mode="aspectFit" aria-hidden="true" />
      </button>
    </view>
  </view>
  <view v-if="chatMenuOpen" class="chat-menu-backdrop" @click.stop="emit('toggleMenu')" />
  <view v-if="chatMenuOpen" class="chat-menu" role="menu">
    <button class="chat-menu-item menu-rename" role="menuitem" :disabled="busy || !activeConversation" @click="emit('menuAction', 'rename')" hover-class="header-title-pressed">
      <text>重命名会话</text>
    </button>
    <button class="chat-menu-item" role="menuitem" :disabled="busy || sending || (!activeConversation && !isDrafting)" @click="emit('menuAction', 'preference')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <text>回应偏好</text><text class="chat-menu-hint">{{ supportStyles.find(item => item.id === selectedMode)?.title }}</text>
    </button>
    <button class="chat-menu-item" role="menuitem" :disabled="busy || !activeConversation" @click="emit('menuAction', 'summary')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <text>整理当前会话</text><text class="chat-menu-hint">生成总结草稿</text>
    </button>
    <button class="chat-menu-item" role="menuitem" :disabled="busy || !activeConversation" @click="emit('menuAction', 'details')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <text>关联探索与设置</text>
    </button>
    <button class="chat-menu-item menu-archive" role="menuitem" :disabled="busy || !activeConversation || !!activeConversation.archived_at" @click="emit('menuAction', 'archive')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <text>归档会话</text><text class="chat-menu-hint">移入归档，探索保留</text>
    </button>
    <button class="chat-menu-item menu-delete" role="menuitem" :disabled="busy || !activeConversation" @click="emit('menuAction', 'delete')" hover-class="header-title-pressed">
      <text>删除会话</text><text class="chat-menu-hint">确认后删除</text>
    </button>
  </view>
</template>
