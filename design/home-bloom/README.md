# Home Bloom artwork

The Home card uses a small character leaning onto its top-right edge. The final
pose was regenerated after owner feedback that the first full-body character
was too large, too low and facing away from the intended card attachment.

- Identity reference: `apps/miniprogram/src/static/companion-bot.png`.
- Composition reference: owner-supplied cream/sage conversation-card image.
- Generation: built-in imagegen, transparent background; no provider API key.
- First source: `bloom-home-source.png` (discarded full-body composition).
- Final source: `bloom-home-top-source.png`.
- Runtime asset: `apps/miniprogram/src/static/bloom-home-top.png`, 210 x 246,
  RGBA palette PNG, approximately 22 KB. Transparent margins were trimmed and
  the image resized with Sharp. No background or card border is baked in.
- UI frame: 76 x 82 CSS pixels, or 70 x 76 on screens up to 360 pixels wide.
  Absolute placement aligns the lower torso and hands with the existing card
  border. No idle translation animation moves the character away from it.

## Final generation prompt

Create ONE standalone transparent PNG of the existing Agency Bloom botanical
robot from the identity reference, in a NEW precise UI corner-hugging pose.
This asset will be displayed very small (72px tall) at the TOP RIGHT CORNER of
a conversation card. Composition and pose are essential: a COMPACT head-and-
upper-torso character in three-quarter LEFT profile, looking toward the LEFT
into the card content. Its ivory ceramic face and sage headphone earpieces
match the reference, two tiny green oval eyes, understated friendly smile,
sage two-leaf sprout. Both small hands reach FORWARD AND DOWN TO THE LEFT and
rest over the SAME invisible horizontal card top edge, as a small friend
peeking over a card. Palms are near the BOTTOM of the image, head above them,
short torso behind the hands; the bottom of the torso is concealed by that
imaginary card. The hands must visibly curl over the imaginary rim and be the
character's lowest points. NOT a standing full body, NO feet, NO rightward
reaching hands, NO leaning away from the card. Keep its upright head compact,
with short leaves (not tall giant foliage), so it remains readable at 72px.
Warm ivory porcelain and muted sage, soft matte 3D material, gentle top-left
lighting, clean edges, high quality quiet friendly app mascot. Transparent
real alpha everywhere outside this single character. Absolutely NO rendered
card, rectangle, edge line, bubble, text, circular avatar surround, background,
props or shadow plane. Tightly framed, only a few transparent pixels margin.
Render the hands so that in the UI they can be aligned exactly with an
existing card's horizontal top border. The reference is identity only; do not
copy the circular frame.
