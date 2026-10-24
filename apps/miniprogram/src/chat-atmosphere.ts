import { svgDataUri } from './icon-system'
import { resolveTheme } from './themes'

const cache = new Map<string, string>()

/** Quiet water contours; separate from Discover's petal shapes. Local and static. */
export function chatAtmosphere(themeId: string) {
  const theme = resolveTheme(themeId)
  if (cache.has(theme.id)) return cache.get(theme.id)!
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600" fill="none">
<g stroke="${theme.palette.accent}" stroke-opacity="${theme.dark ? '.075' : '.05'}" stroke-width="1.2">
<path d="M960 150C780 120 700 220 730 320C760 430 950 415 1000 540"/>
<path d="M970 190C815 155 747 238 774 322C807 419 956 406 1020 520"/>
<path d="M-160 1060C80 975 315 1090 278 1262C250 1390 45 1338-55 1480"/>
<path d="M-140 1100C65 1030 266 1120 230 1260C200 1370 30 1342-65 1450"/>
<path d="M-120 1140C62 1080 213 1150 180 1255C149 1355 20 1340-75 1420"/>
</g></svg>`
  const uri = svgDataUri(source)
  cache.set(theme.id, uri)
  return uri
}
