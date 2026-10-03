---
workflow: product-launch-video
flow: automation
storyboard: no
message: "나중에 보려고 저장한 북마크, Tidymark가 제자리를 찾아 줘요."
destination: youtube
aspect: 1920x1080
language: ko
audience: "Anyone with a pile of Chrome bookmarks saved 'for later' — recipes, trips, shopping, articles"
length: 40s
angle: playful problem → reveal → the four ways to tidy → checkup → safe by design → install
---

## Intent

Korean version of videos/tidymark-promo — same cut, timing and soundtrack; Korean copy, Korean UI captures and Korean mode clips, Pretendard for Hangul.


A high-definition, creative, playful and joyful launch video for Tidymark, the Chrome
extension that files every bookmark where it belongs (site: https://tidy.tmtt.link/).
The user asked: "You need to enjoy watching", "use as much as possible of the input images
to make it more creative and more authentic", "produce the best of what you can".

## Assets

- ../../dist/store-assets/en/screenshot-1..4.png — real English UI: popup suggestion, no-fit popup, studio modes, checkup.
- ../../dist/store-assets/en/promo-marquee.png, promo-small.png — brand tiles with the tagline.
- ../../extension/videos/mode-{a,b,c,d}-en.mp4 — the four mode explainer clips (4.5s each, 1280x720).
- ../../extension/icons/logo.svg — the star mark.
- capture/ — tidy.tmtt.link captured screens.

## Customizations

- Sound: no voice-over. Music bed and sound effects are synthesized in JavaScript (Node, WAV out) and
  timed to the frame events — pops when chips land, whooshes on moves, a chime on save, a thud on folders.
- Everyday examples only (recipes, running, Lisbon trip, home) — same world as the site.

## Notes

- Light look only (the user dislikes dark mode): paper #f3f0e7, ink #18181a, lime #c8f25a, sky, amber, violet.
- The Mac app is unreleased and not on the site — leave it out.
- Don't claim store availability dates; the CTA points to tidy.tmtt.link.
