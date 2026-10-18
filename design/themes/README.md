# Agency Bloom Theme References

This folder contains the visual references for the six Agency Bloom themes. Reference artwork defines each theme's atmosphere; the Mini Program uses compressed derivatives and a matching interface palette.

## Reference library

| Theme | Saved ID | Reference source | Visual direction |
| --- | --- | --- | --- |
| Morning Mist | `light` | [mist.png](references/mist.png) | A seated figure seen from behind, mist-covered ridges, a winding lake, and soft morning sunlight |
| Quiet Night | `dark` | [night.jpg](references/night.jpg) | An ink-blue night sky, a crescent moon, and a quiet mountain lake |
| First Light | `dawn` | [dawn.jpg](references/dawn.jpg) | A rising sun, pale apricot light, and warm reflections on still water |
| Forest | `forest` | [forest.jpg](references/forest.jpg) | Moss, fern fronds, layered trees, and diffused woodland light |
| Lavender | `lavender` | [lavender.jpg](references/lavender.jpg) | Real lavender flowers, dusty foliage, and soft grey-lilac light |
| Minimal | `minimal` | [minimal.jpg](references/minimal.jpg) | An ivory plaster surface, a gentle architectural shadow, and open space |

## Morning Mist replacement

On October 18, 2026, the user-selected library image at `references/mist.png` replaced the earlier Morning Mist artwork. This PNG is the authoritative source. Keep it unchanged; do not replace it with a generated approximation or recreate a `mist.jpg` reference from the earlier image.

Two runtime files are derived directly from this source:

| File, relative to the repository root | Purpose | Dimensions |
| --- | --- | --- |
| `apps/miniprogram/src/static/themes/mist.jpg` | Home atmosphere image | 640 × 960 |
| `apps/miniprogram/src/static/themes/mist-preview.jpg` | Theme picker thumbnail | 360 × 224 |

The background uses a centered cover resize and JPEG quality 68. The thumbnail uses the source crop `left=0, top=786, width=941, height=586`, then resizes to 360 × 224 with JPEG quality 77. This framing keeps the back-facing figure, misty ridges, lake, and morning light recognizable in the small card. Both files use MozJPEG compression.

The reference remains 941 × 1672 pixels. Only these two Morning Mist runtime images were replaced; the theme name, saved ID, palette, and other five themes were left unchanged in this update.

## Runtime integration

The theme catalog and interface palettes live in `apps/miniprogram/src/themes.ts`. Each entry points to a background and a separate thumbnail under `apps/miniprogram/src/static/themes/`. Theme presentation rules live in `apps/miniprogram/src/themes.scss`.

Keep the high-resolution references outside the Mini Program's static directory. Package only the compressed runtime images. Use the same source artwork for a theme's background and thumbnail, and check the crop at its actual display size.

`prompts.json` records the earlier built-in image-generation prompts for the collection. Its Morning Mist prompt describes the superseded generated image, not the current user-selected PNG. The PNG takes precedence over that historical prompt.

Run `node tools/prepare-themes.mjs` to rebuild all compressed derivatives, or pass asset names such as `mist` to rebuild selected assets. The script reads the approved PNG/JPEG references and explicit crop recipes; it never rewrites references. Morning Mist uses the PNG and crop documented above.

## Checking the replacement

With the existing Mini Program watcher running, saving the runtime files updates the development output. Recompile in WeChat Developer Tools if the image cache still shows the previous artwork. For a fresh build, run `npm run build:mp` from the repository root.

Check Morning Mist in the appearance picker and on the home screen. The thumbnail should show the selected figure and landscape rather than the previous empty misty lake. No image-generation or language-model request is needed for this replacement.


## Integrated presentation

`themes.ts` supplies the home image, palette, translucent card surfaces, hero wash, five navigation SVGs, and the central action gradient. Morning Mist now uses the soft blue navigation treatment from the approved home concept; the other themes use their own coordinated colors.

The appearance picker renders `ThemePreview.vue`, a miniature of the actual image/card/navigation composition. It reads the same `theme.image` and `themeStyle()` as the live home. The separate cropped thumbnail files remain available as derivatives, but are not substituted for the image in this miniature. Login uses the default Morning Mist image and theme tokens; authenticated personal pages restore the account theme.

The home presents the user's current direction, three deliberate entry actions, and a quiet reflection. Plan contains the existing confirmed next step, full editable decision card, and feedback timeline. Discover offers fixed reflection questions that enter an editable chat draft only after a tap. Neither section starts an AI call, creates a record, or invents completed tasks.

Native acceptance: `node tools/verify-theme-experience-native.cjs` targets the root development project on port 9430, mocks all requests, and restores storage. It covers six theme selections and persistence, matching preview/home/login sources, five functional destinations, privacy preservation, failed saves, empty accounts, and composer clearance. Screenshots and its report are in `output/theme-completion`.


## October 18 completion validation

The final pass keeps hero text directly on the scene: high-contrast theme ink and a full-width atmospheric gradient, without caption cards. Header actions use 44px circles with centered 22px SVG images; their measured horizontal and vertical centers are checked in every palette. The appearance sheet stops inner click propagation so interacting with a preview cannot dismiss the sheet.

Validation: TypeScript check, native production build and WeChat compiler checks; 10 frontend theme/entry tests and 5 backend theme preference tests. Native acceptance uses a 430 x 932 simulator. Physical-device rendering and auxiliary H5 browsers remain outside this acceptance run.
