import { svgDataUri } from './icon-system'
import { resolveTheme } from './themes'

const cache = new Map<string, string>()
/** Brand-scale petal contours, drawn locally from the current theme palette. */
export function discoverAtmosphere(themeId: string) {
  const theme = resolveTheme(themeId)
  const cached = cache.get(theme.id)
  if (cached) return cached
  const { accent, gold, soft } = theme.palette
  const strength = theme.dark ? '.15' : '.11'
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600" fill="none">
<defs>
 <linearGradient id="petal" x1="830" y1="0" x2="280" y2="780" gradientUnits="userSpaceOnUse"><stop stop-color="${accent}" stop-opacity="${theme.dark ? '.11' : '.08'}"/><stop offset="1" stop-color="${soft}" stop-opacity="0"/></linearGradient>
 <linearGradient id="leaf" x1="0" y1="1160" x2="550" y2="1500" gradientUnits="userSpaceOnUse"><stop stop-color="${gold}" stop-opacity=".075"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
</defs>
<path d="M941-96C592-92 382 127 421 334C452 499 653 520 731 360C796 227 716 77 941-96Z" fill="url(#petal)"/>
<path d="M941-96C1008 114 902 464 688 510C508 549 403 420 466 278C531 130 764 157 941-96Z" fill="url(#petal)"/>
<path d="M941-96C765 199 939 534 713 671C573 756 367 684 334 521C300 356 521 247 941-96Z" fill="url(#petal)"/>
<g stroke="${accent}" stroke-opacity="${strength}" stroke-width="1.4">
 <path d="M941-96C592-92 382 127 421 334C452 499 653 520 731 360C796 227 716 77 941-96Z"/>
 <path d="M941-96C1008 114 902 464 688 510C508 549 403 420 466 278C531 130 764 157 941-96Z"/>
 <path d="M941-96C765 199 939 534 713 671C573 756 367 684 334 521C300 356 521 247 941-96Z"/>
 <path d="M941-96C729 163 570 273 515 467C465 647 528 776 632 841" stroke-opacity=".65"/>
</g>
<path d="M-72 1036C173 1034 373 1166 401 1330C430 1502 209 1539 106 1399C23 1285 45 1161-72 1036Z" fill="url(#leaf)"/>
<g stroke="${gold}" stroke-opacity=".11" stroke-width="1.3">
 <path d="M-72 1036C173 1034 373 1166 401 1330C430 1502 209 1539 106 1399C23 1285 45 1161-72 1036Z"/>
 <path d="M-72 1036C57 1175 387 1194 475 1373C546 1518 412 1660 255 1606C78 1545 116 1250-72 1036Z"/>
 <path d="M-72 1036C67 1251 226 1343 297 1497C342 1592 336 1686 315 1744" stroke-opacity=".6"/>
</g></svg>`
  const uri = svgDataUri(source)
  cache.set(theme.id, uri)
  return uri
}
