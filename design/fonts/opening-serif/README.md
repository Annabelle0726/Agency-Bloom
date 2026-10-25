# Opening-only embedded serif

The iPhone Mini Program screenshot supplied by the owner showed the earlier
locally installed FangSong fallback resolving to a sans-serif. Font-family
names alone did not provide the intended face on the target device.

`apps/miniprogram/src/opening-serif.scss` embeds a **19,604-byte WOFF** subset of
Noto Serif SC at weight 400, under the distinct family `Bloom Opening Serif`.
It contains the 81 characters used in the login heading, five opening titles and closing
passages. It adds no runtime network font request or remote-domain requirement.
Body copy and controls continue to use the platform sans-serif stack.

This is a deliberate exception to the older system-font-only design note:
the owner requested the intended serif to work on iPhone as well as desktop.
No fonts are downloaded while the application runs. WOFF avoids the older-iOS
WOFF2 compatibility limitation documented by uni-app.

## Rebuild

Download the upstream font to an ignored working directory, then run:

```powershell
uv run --no-project --with fonttools==4.61.1 python tools/prepare-opening-font.py --source PATH_TO_UPSTREAM_TTF
```

Upstream source: https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf

`manifest.json` records source/output hashes, weight and Unicode coverage. The
generator extracts the actual opening copy, subsets the font, fixes the weight
to regular, retains copyright/license metadata and renames the derived face.
After editing the login heading, opening titles or closing copy, regenerate the subset and
run `tests/opening-font.test.ts` to prevent missing-glyph fallback.

## License and platform references

The font is redistributed under **SIL Open Font License 1.1**. See `OFL.txt` and
the license metadata retained inside the font. The original full variable font
is not shipped. Its source and license are provided by the Google Fonts repo:
https://github.com/google/fonts/tree/main/ofl/notoserifsc

uni-app documents Base64 CSS fonts for Mini Programs, which cannot directly
reference packaged font files in CSS:
https://uniapp.dcloud.io/tutorial/syntax-css.html#字体图标

uni-app recommends TTF/WOFF for webview fonts because older iOS may not support
WOFF2: https://uniapp.dcloud.net.cn/api/ui/font.html

The embedded CSS face is separate from the HTTPS-only `loadFontFace` API; no
network font-loader API is used. Native compilation and H5 font-resolution
checks do not substitute for confirming the result on the original iPhone.
