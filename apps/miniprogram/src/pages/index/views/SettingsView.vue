<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { settingsAtmosphere } from '../../../settings-atmosphere'
import { canonicalSupportStyle, supportStyles } from '../../../onboarding'
import type { ThemeDefinition } from '../../../themes'
import type { User } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  user: User | null
  userAvatar: string
  avatarBusy: boolean
  activeTheme: ThemeDefinition
  busy: boolean
  themeAuto: boolean
  themeBusy: boolean
  nextThemeBoundary: string
  usage: { used_cny: number; limit_cny: number; daily_calls: number; daily_limit: number; mode: string }
  aiMode: string
}>()
const atmosphere = computed(() => settingsAtmosphere(props.activeTheme.id))
const emit = defineEmits<{
  appearance: []
  toggleThemeAuto: []
  toggleSave: []
  toggleAi: []
  support: []
  direction: []
  memories: []
  privacy: []
  speech: []
  logout: []
  deleteAccount: []
  chooseAvatar: [event: { detail: { avatarUrl?: string } }]
  avatarError: []
}>()
</script>

<template>
  <view class="settings-content">
    <image class="settings-atmosphere" :src="atmosphere" mode="aspectFill" aria-hidden="true" />
    <view class="settings-foreground">
    <text class="eyebrow">MAKE YOURSELF AT HOME</text>
    <text class="page-title">{{ '你的空间，由你做主' }}</text>
    <view class="settings-group avatar-settings">
      <view class="avatar-profile">
        <!-- #ifdef MP-WEIXIN -->
        <button class="avatar-entry" open-type="chooseAvatar" :disabled="avatarBusy"
                :aria-label="avatarBusy ? '正在保存头像' : '更改头像'" hover-class="avatar-entry-pressed"
                :hover-start-time="0" :hover-stay-time="70" @chooseavatar="emit('chooseAvatar', $event)">
          <image class="profile-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
                 @error="emit('avatarError')"/>
          <view class="avatar-edit-badge" aria-hidden="true"><SvgIcon name="camera" :size="10" light/></view>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <image class="profile-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
               @error="emit('avatarError')"/>
        <!-- #endif -->
        <view>
          <text class="setting-title">你的对话头像</text>
        </view>
      </view>
    </view>
    <view class="settings-group">
      <button class="setting-row" @click="emit('appearance')" hover-class="pressed"
              :hover-start-time="0" :hover-stay-time="70">
        <view>
          <text class="setting-title">外观设置</text>
          <text class="setting-description">{{ activeTheme.name }} · {{ activeTheme.english }}</text>
        </view>
        <SvgIcon name="chevron" :size="17"/>
      </button>
      <button class="setting-row" :disabled="busy || themeBusy" :aria-pressed="themeAuto"
              @click="emit('toggleThemeAuto')" hover-class="pressed"
              :hover-start-time="0" :hover-stay-time="70">
        <view>
          <text class="setting-title">随时间自动切换</text>
          <text class="setting-description">
            {{ themeAuto ? '已开启 · 手动选择保留到 ' + nextThemeBoundary + '，之后恢复时间主题' : '已关闭 · 手动选择的主题会长期保留' }}
          </text>
        </view>
        <view class="toggle" :class="{ on: themeAuto }">
          <view/>
        </view>
      </button>
      <button class="setting-row" :disabled="busy" @click="emit('toggleSave')" hover-class="pressed"
              :hover-start-time="0" :hover-stay-time="70">
        <view>
          <text class="setting-title">保存完整聊天</text>
          <text class="setting-description">默认开启 · 关闭会清除聊天和总结；长期记忆单独管理</text>
        </view>
        <view class="toggle" :class="{ on: user?.save_chat }">
          <view/>
        </view>
      </button>
    </view>
    <view class="settings-group">
      <button class="setting-row" :disabled="busy" @click="emit('toggleAi')" hover-class="pressed"
              :hover-start-time="0" :hover-stay-time="70">
        <view>
          <text class="setting-title">允许 AI 对话</text>
          <text class="setting-description">可以随时撤回同意，停止新的处理</text>
        </view>
        <view class="toggle" :class="{ on: user?.ai_consent }">
          <view/>
        </view>
      </button>
    </view>
    <view class="settings-group">
      <button class="setting-row" @click="emit('support')" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70">
        <view>
          <text class="setting-title">新会话的默认回应方式</text>
          <text class="setting-description">
            {{ supportStyles.find(item => item.id === canonicalSupportStyle(user?.support_style))?.title }}
          </text>
        </view>
        <SvgIcon name="chevron" :size="17"/>
      </button>
    </view>
    <view class="settings-group">
      <text class="group-label">我的记录</text>
      <button class="setting-row speech-settings" @click="emit('speech')" hover-class="pressed"><view><text class="setting-title">朗读与语音隐私</text><text class="setting-description">按需播放、查看说明或撤回授权</text></view><SvgIcon name="volume" :size="17" /></button>
      <button class="setting-row current-direction" @click="emit('direction')"><view><text class="setting-title">当前方向与初始资料</text><text class="setting-description">查看、修改阶段目标，管理初始快照</text></view><SvgIcon name="chevron" :size="17" /></button>
      <button class="setting-row" @click="emit('memories')"><view><text class="setting-title">整理长期记忆</text><text class="setting-description">{{ user?.use_memory ? '已启用 · 可编辑、停用、合并或删除' : '尚未用于回复 · 由你确认和管理' }}</text></view><SvgIcon name="chevron" :size="17" /></button>
      <button class="setting-row" @click="emit('privacy')" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70">
        <text class="setting-title">隐私与使用说明</text>
        <SvgIcon name="arrow-diagonal" :size="17"/>
      </button>
    </view>
    <view class="usage-card">
      <text class="eyebrow">温和使用，慢慢推进</text>
      <text class="body-copy">今天已对话 {{ usage.daily_calls }} / {{ usage.daily_limit }} 次</text>
      <text class="muted small">
        {{ aiMode === 'demo' ? '当前为本地演示，不产生模型费用' : '服务额度用完后，卡片和反馈仍可使用' }}
      </text>
    </view>
    <button class="secondary logout-button" :disabled="busy" @click="emit('logout')" hover-class="gem-logout-pressed"
            :hover-start-time="0" :hover-stay-time="70">退出登录
    </button>
    <button class="text-button danger-link" :disabled="busy" @click="emit('deleteAccount')" hover-class="pressed"
            :hover-start-time="0" :hover-stay-time="70">删除账号与全部个人记录
    </button>
    <text class="version-label">{{ 'AGENCY BLOOM · 0.1.0\n给自己一点空间' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.settings-atmosphere { position: fixed; z-index: 0; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; max-width: 440px; margin: auto; pointer-events: none; }
.settings-foreground { position: relative; z-index: 1; }
</style>
