import { svgDataUri } from './icon-system'
import { resolveTheme } from './themes'

const cache = new Map<string, string>()

/** Intertwining vines with attached heart-shaped foliage, kept at the page edges. */
export function settingsAtmosphere(themeId: string) {
  const theme = resolveTheme(themeId)
  const cached = cache.get(theme.id)
  if (cached) return cached
  const { accent, gold } = theme.palette
  const foliage = (items: number[][]) => items.map(([x, y, angle, scale]) => `<use xlink:href="#vine-leaf" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"/>`).join('')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1600" viewBox="0 0 900 1600" fill="none" stroke-linecap="round" stroke-linejoin="round">
<defs><g id="vine-leaf" stroke-width="1.7">
 <path d="M0 0C-12-21-37-15-39 7C-42 34-8 61 1 85C9 56 42 31 35 7C30-16 10-20 0 0Z" fill="${accent}" fill-opacity=".035"/>
 <path d="M0 0C-3 27 3 56 1 80M-1 21L-23 10M0 36L21 22M1 48L-19 33M2 61L20 43" opacity=".55"/>
</g></defs>
<g stroke="${accent}" stroke-opacity="${theme.dark ? '.18' : '.14'}" stroke-width="2">
 <path d="M892-92C765-15 728 89 766 192C800 284 881 316 822 423C785 490 728 521 748 630C759 695 805 741 825 790" stroke-width="3.6"/>
 <path d="M848-70C830 59 704 126 754 229C793 310 862 339 807 437C767 508 742 553 777 631C802 690 826 739 815 806" opacity=".7"/>
 <path d="M784 78Q778 67 772 54M754 145Q729 132 706 138M766 192Q768 213 777 220M843 343Q843 331 837 324M792 480Q782 469 775 462M747 583Q738 568 747 555M794 703L798 692"/>
 <path d="M810 410C770 411 739 380 747 356C754 338 778 341 778 358C778 369 765 372 760 364" stroke-width="1.4" opacity=".7"/>
 ${foliage([[772,54,-35,.55],[706,138,48,.58],[777,220,-55,.75],[837,324,22,.48],[775,462,56,.62],[747,555,-28,.5],[798,692,35,.55]])}
</g>
<g stroke="${gold}" stroke-opacity="${theme.dark ? '.16' : '.12'}" stroke-width="1.8">
 <path d="M104 1680C194 1592 178 1500 119 1422C53 1336 174 1282 165 1192C158 1121 93 1087 144 995" stroke-width="3.2"/>
 <path d="M146 1680C188 1540 80 1481 114 1373C137 1300 196 1252 151 1169C123 1117 112 1056 157 1015" opacity=".65"/>
 <path d="M159 1551Q121 1536 92 1505M117 1422Q128 1402 146 1390M132 1320L105 1300M162 1225L177 1210M133 1158Q127 1140 116 1128"/>
 <path d="M137 1348C181 1337 205 1362 192 1384C183 1400 162 1391 165 1378" stroke-width="1.3" opacity=".7"/>
 ${foliage([[92,1505,-58,.7],[146,1390,42,.55],[105,1300,-52,.6],[177,1210,35,.65],[116,1128,-35,.42]])}
</g></svg>`
  const uri = svgDataUri(source)
  cache.set(theme.id, uri)
  return uri
}
