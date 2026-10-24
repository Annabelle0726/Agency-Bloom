<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import MeAccordion from '../../../components/MeAccordion.vue'
import MeRecordsPanel from '../../../components/MeRecordsPanel.vue'
import type { MeRequest } from '../../../me-records'
import { settingsAtmosphere } from '../../../settings-atmosphere'
import { canonicalSupportStyle, supportStyles } from '../../../onboarding'
import type { ThemeDefinition } from '../../../themes'
import type { Issue, User } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  user: User | null
  current: Issue | null
  request: MeRequest
  recordsRevision: number
  userAvatar: string
  avatarBusy: boolean
  activeTheme: ThemeDefinition
  busy: boolean
  themeAuto: boolean
  themeBusy: boolean
  nextThemeBoundary: string
  usage: { used_cny: number; limit_cny: number; daily_calls: number; daily_limit: number; mode: string }
  aiMode: string
  devAuth?: boolean
}>()
const expanded = ref('')
function toggleGroup(id: string) { expanded.value = expanded.value === id ? '' : id }
watch(() => props.user?.id, () => { expanded.value = '' })
const atmosphere = computed(() => settingsAtmosphere(props.activeTheme.id))
const emit = defineEmits<{
  contextChanged: []
  userChanged: [user: User]
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
  restartDemo: []
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
    <view class="me-groups">
    <MeAccordion id="me-records" title="我的资料与记录" summary="方向、记忆、初始回答与变化" :open="expanded === 'records'" @toggle="toggleGroup('records')">
    <MeRecordsPanel :user="user" :current="current" :request="request" :revision="recordsRevision" :busy="busy" :theme-id="activeTheme.id"
                    @direction="emit('direction')" @memories="emit('memories')" @changed="emit('contextChanged')" @user-changed="emit('userChanged', $event)" />
    </MeAccordion>
    <MeAccordion id="me-privacy" title="数据与授权" summary="AI 对话、聊天保存、语音与隐私" :open="expanded === 'privacy'" @toggle="toggleGroup('privacy')">
      <view class="me-section">
      <button class="setting-row" :disabled="busy" :aria-pressed="!!user?.ai_consent" @click="emit('toggleAi')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <view><text class="setting-title">允许 AI 处理对话</text><text class="setting-description">{{ user?.ai_consent ? '已同意 · 可随时撤回，停止新的处理' : '尚未同意 · 开启前会说明处理范围' }}</text></view><view class="toggle" :class="{ on: user?.ai_consent }"><view /></view>
      </button>
      <button class="setting-row" :disabled="busy" :aria-pressed="!!user?.save_chat" @click="emit('toggleSave')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <view><text class="setting-title">保存完整聊天</text><text class="setting-description">{{ user?.save_chat ? '已开启 · 关闭将清除聊天原文和总结' : '已关闭 · 本次聊天仅临时保留，离开后不恢复' }}；独立确认的记忆和记录单独管理</text></view><view class="toggle" :class="{ on: user?.save_chat }"><view /></view>
      </button>
      <button class="setting-row speech-settings" @click="emit('speech')" hover-class="pressed" :hover-start-time="0"><view><text class="setting-title">朗读与语音隐私</text><text class="setting-description">单独授权、按需播放，可随时撤回</text></view><SvgIcon name="volume" :size="17" /></button>
      <button class="setting-row" @click="emit('privacy')" hover-class="pressed" :hover-start-time="0"><view><text class="setting-title">隐私与使用说明</text><text class="setting-description">了解保存、使用与删除的边界</text></view><SvgIcon name="arrow-diagonal" :size="17" /></button>
      </view>
    </MeAccordion>
    <MeAccordion id="me-preferences" title="回应与外观" :summary="(supportStyles.find(item => item.id === canonicalSupportStyle(user?.support_style))?.title || '') + ' · ' + activeTheme.name" :open="expanded === 'preferences'" @toggle="toggleGroup('preferences')">
      <view class="me-section">
      <button class="setting-row" @click="emit('support')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view><text class="setting-title">新会话的默认回应方式</text><text class="setting-description">{{ supportStyles.find(item => item.id === canonicalSupportStyle(user?.support_style))?.title }}</text><text class="me-preference-note">当前会话已选的方式不变，也可以在对话中直接说</text></view><SvgIcon name="chevron" :size="17" /></button>
      <button class="setting-row" @click="emit('appearance')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view><text class="setting-title">外观设置</text><text class="setting-description">{{ activeTheme.name }} · {{ activeTheme.english }}</text></view><SvgIcon name="chevron" :size="17" /></button>
      <button class="setting-row" :disabled="busy || themeBusy" :aria-pressed="themeAuto" @click="emit('toggleThemeAuto')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view><text class="setting-title">随时间自动切换</text><text class="setting-description">{{ themeAuto ? '已开启 · 手动选择保留到 ' + nextThemeBoundary : '已关闭 · 手动选择的主题会长期保留' }}</text></view><view class="toggle" :class="{ on: themeAuto }"><view /></view></button>
    </view>
    </MeAccordion>
    </view>
    <view class="me-usage"><text>今天已对话 {{ usage.daily_calls }} / {{ usage.daily_limit }} 次</text><text>{{ aiMode === 'demo' ? '本地演示 · 不产生模型费用' : '额度用完后，记录仍可查看' }}</text></view>
    <view v-if="devAuth" class="settings-group">
      <button class="setting-row" :disabled="busy" @click="emit('restartDemo')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <view><text class="setting-title">重新注册（本机演示）</text><text class="setting-description">返回注册页，用新演示账号重新体验五步引导</text></view>
        <SvgIcon name="arrow-diagonal" :size="17" />
      </button>
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
.settings-content .avatar-settings { margin:18px 0 22px; }
.settings-content .page-title { font-size:26px; line-height:1.6; }
.me-groups { margin:4px 0 0; }
.me-section { margin:0; }
.me-usage { display:flex; flex-wrap:wrap; gap:2px 12px; margin:18px 0 22px; color:var(--muted); font-family:var(--font-body); font-size:var(--type-caption); font-weight:400; line-height:1.8; }
.me-section .setting-row { padding:15px 0; gap:16px; font-family:var(--font-body); font-weight:400; }
.me-section .setting-title,.me-section .setting-description,.me-preference-note { font-family:var(--font-body); font-weight:400; }
.me-section .setting-row > view:first-child { flex:1; min-width:0; }
.me-section .toggle { flex-shrink:0; }
.me-preference-note { display:block; margin-top:5px; font-size:12px; line-height:1.75; color:var(--muted); }
@media(max-width:360px) { .settings-content { padding-left:20px; padding-right:20px; } .settings-content .page-title { font-size:23px; } }
</style>
