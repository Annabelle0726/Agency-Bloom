<style lang="scss" src="./h5-reset.scss"></style>
<style lang="scss" src="./styles.scss"></style>
<style lang="scss" src="./tokens.scss"></style>
<style lang="scss" src="./alpha.scss"></style>
<style lang="scss" src="./night-home.scss"></style>
<style lang="scss" src="./companion-chat.scss"></style>
<style lang="scss" src="./brand.scss"></style>
<style lang="scss" src="./chat-entry.scss"></style>
<style lang="scss" src="./bottom-nav.scss"></style>
<style lang="scss" src="./themes.scss"></style>
<style lang="scss" src="./workspace.scss"></style>
<style lang="scss" src="./bloom-pages.scss"></style>
<style lang="scss" src="./ui-foundation.scss"></style>
<style lang="scss" src="./surface-actions.scss"></style>
<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { refreshHomeQuote } from './use-home-quote'
onLaunch(() => {})
onShow(refreshHomeQuote)
</script>
