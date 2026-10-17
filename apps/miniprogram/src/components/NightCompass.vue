<template>
  <view class="night-compass" aria-hidden="true">
    <view class="compass-halo" />
    <image class="compass-jade" src="/static/art/jade-compass.png" mode="aspectFit" />
  </view>
</template>

<style scoped>
.night-compass { position:relative; width:100px; height:86px; margin:auto; }
.compass-halo { position:absolute; width:144px; height:124px; left:-22px; top:-19px; border-radius:50%; background:radial-gradient(ellipse,rgba(165,202,195,.12),rgba(121,162,166,.03) 48%,transparent 72%); animation:jade-breathe 6s ease-in-out infinite; pointer-events:none; }
.compass-jade { position:relative; display:block; width:100px; height:86px; }
@keyframes jade-breathe { 0%,100% { opacity:.55; transform:scale(.96); } 50% { opacity:1; transform:scale(1.04); } }
@media(prefers-reduced-motion:reduce) { .compass-halo { animation:none; opacity:.7; } }
</style>
