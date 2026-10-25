<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { homeRecordsFor, type HomeRecord } from '../home-records'
import type { Issue } from '../domain'
import type { ResolvedVisual } from '../visual-library'

defineOptions({ options:{styleIsolation:'apply-shared'} })
const props=withDefaults(defineProps<{ issue:Issue; exclude?:string[]; visual?:ResolvedVisual|null }>(),{exclude:()=>[],visual:null})
const emit=defineEmits<{plan:[];feedback:[]}>()
const records=computed(()=>homeRecordsFor(props.issue,props.exclude))
const expanded=ref('')
const failedSrc=ref('')
function hideVisual(){failedSrc.value=props.visual?.src||''}
watch(()=>props.issue.id,()=>{expanded.value=''},{flush:'sync'})
watch(records,items=>{if(!items.some(item=>item.id===expanded.value))expanded.value=''})
function open(item:HomeRecord){
  if(item.destination==='plan')emit('plan')
  else expanded.value=expanded.value===item.id?'':item.id
}
</script>

<template>
  <view v-if="records.length" class="home-records" data-home="records">
    <view class="home-records-header">
      <text class="home-records-title">接着上次</text>
      <button v-if="!issue.ended_at" class="home-records-add" data-home="add-record" hover-class="home-record-pressed" :hover-start-time="0" @click="emit('feedback')">
        <text>记一点新情况</text><SvgIcon name="plus" :size="14" tone="accent"/>
      </button>
      <text v-else class="home-records-status">已结束的探索</text>
    </view>
    <view class="home-records-list">
      <button v-for="item in records" :key="item.id" class="home-record-row" :class="'record-'+item.kind"
        :data-record="item.id" :data-destination="item.destination" :aria-label="item.destination==='plan'?'查看已保存的计划：'+item.text:(expanded===item.id?'收起记录：':'展开记录：')+item.text"
        :aria-expanded="item.destination==='expand'?expanded===item.id:undefined" hover-class="home-record-pressed" :hover-start-time="0" @click="open(item)">
        <view class="home-record-copy">
          <view class="home-record-meta">
            <SvgIcon :name="item.icon" :size="18" tone="accent"/>
            <text class="home-record-label">{{ item.kind==='step'?item.label:'后来发生的事' }}</text><text v-if="item.dateLabel" class="home-record-date">{{ item.dateLabel }}</text>
          </view>
          <text class="home-record-text" :class="{'record-expanded':expanded===item.id||item.kind==='step'}" :selectable="expanded===item.id">{{ item.text }}</text>
          <view class="home-record-link"><text :class="{'home-record-fold':expanded===item.id}">{{ item.kind==='step'?'查看完整尝试':expanded===item.id?'收起记录':'查看完整记录' }}</text><SvgIcon :name="expanded===item.id?'arrow-up':'arrow'" :size="16" tone="accent"/></view>
        </view>
        <image v-if="item.kind==='step'&&visual&&failedSrc!==visual.src" class="home-record-art" :src="visual.src" mode="aspectFill" aria-hidden="true" @error="hideVisual"/>
      </button>
    </view>
  </view>
  <button v-else-if="!issue.ended_at" class="home-record-empty-action" data-home="first-record" hover-class="home-record-pressed" :hover-start-time="0" @click="emit('feedback')">
    <SvgIcon name="plus" :size="16" tone="accent"/><text>记一点新情况</text><view class="home-record-empty-arrow"><SvgIcon name="chevron" :size="15" tone="muted"/></view>
  </button>
  <button v-else class="home-record-empty-action" data-home="ended-records" hover-class="home-record-pressed" :hover-start-time="0" @click="emit('plan')">
    <SvgIcon name="note" :size="20" tone="accent"/><text>查看已结束的探索</text><view class="home-record-empty-arrow"><SvgIcon name="chevron" :size="15" tone="muted"/></view>
  </button>
</template>

<style scoped lang="scss">
.home-records { padding:0 2px; }
.home-records-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding-bottom:8px; }
.home-records-title { color:var(--ink); font-family:var(--font-heading); font-size:18px; font-weight:400; line-height:30px; letter-spacing:.4px; }
.home-records-add { display:flex; align-items:center; justify-content:center; gap:4px; flex-shrink:0; min-height:44px; margin:0 -4px 0 0; padding:0 4px; color:var(--action-text); background:transparent; font-family:var(--font-body); font-size:14px; font-weight:500; line-height:21px; border-radius:6px; }
.home-records-status { color:var(--muted); font-family:var(--font-body); font-size:12px; font-weight:400; line-height:18px; }
.home-record-row { position:relative; display:flex; align-items:flex-start; gap:16px; box-sizing:border-box; width:100%; height:auto; min-height:44px; margin:0; padding:16px 0; text-align:left; border:0; border-radius:0; background:transparent; transition:background-color 100ms ease-out; }
.home-record-copy { flex:1; min-width:0; }
.home-record-text { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-top:8px; white-space:pre-line; overflow-wrap:break-word; font-family:var(--font-body); font-size:14px; font-weight:400; line-height:24px; color:var(--ink); }
.home-record-text.record-expanded { display:block; -webkit-line-clamp:unset; overflow:visible; }
.home-record-meta { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; }
.home-record-label,.home-record-date { color:var(--muted); font-family:var(--font-body); font-size:12px; font-weight:400; line-height:18px; }
.record-step .home-record-label { color:var(--focus-plan-ink); }
.record-change .home-record-label { color:var(--ink); }
.home-record-link { display:flex; align-items:center; gap:8px; margin-top:12px; color:var(--action-text); font-family:var(--font-body); font-size:14px; font-weight:500; line-height:21px; }
.home-record-art { display:block; flex:0 0 72px; width:72px; height:96px; margin-top:4px; border-radius:8px; pointer-events:none; }
.home-record-empty-action { display:flex; align-items:center; gap:12px; box-sizing:border-box; width:100%; min-height:44px; margin:0; padding:8px 2px; color:var(--action-text); background:transparent; border:0; border-radius:6px; font-family:var(--font-body); font-size:14px; font-weight:500; line-height:21px; }
.home-record-empty-arrow { display:flex; align-items:center; justify-content:center; margin-left:auto; }
.home-record-pressed { background-color:var(--glass-chip); }
.home-record-row::after,.home-records-add::after,.home-record-empty-action::after { content:none; border:0; }
@media (max-width:360px) { .home-records-header { gap:8px; } .home-record-row { gap:12px; } .home-record-art { flex-basis:60px; width:60px; height:80px; } }
@media (prefers-reduced-motion:reduce) { .home-record-row { transition:none; } }
</style>
