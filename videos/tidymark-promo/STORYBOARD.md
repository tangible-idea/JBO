---
format: 1920x1080
duration: 42s
message: "You saved it for later. Tidymark finds it a place."
arc: Hook (the pile) → Question → Reveal (the star sweeps in) → One click → No forced fits → Four ways → Checkup → Safe → Install
audience: Anyone with a pile of Chrome bookmarks saved "for later"
mode: autonomous
music: none
sound: custom — music bed + SFX synthesized in JavaScript (scripts/make-audio.mjs), placed in index.html after assembly
---

## Frame 1 — The pile

- scene: Bookmark chips rain down from the top and bounce into a messy heap while a counter ticks to 1,730; "You saved it for later." lands on a lime highlight
- duration: 4.6s
- poster: 3.8s
- transition_in: cut
- status: animated
- src: compositions/frames/01-pile.html
- asset_candidates: none (chips are type + colour dots in the site's chip style; the line is the site's own hero copy)
- sfx: one soft marimba pluck per chip landing (rising pitch), a tick per counter step, a pop when the headline lands

Cold open on the problem everyone has: twenty everyday bookmarks ("Weeknight lasagna", "Lisbon in 3 days", "Running shoe review", "Untitled", "New Tab", "Banana bread", "Standing desks compared", "Toddler sleep guide", "10K training plan"…) tumble into a heap. The site's hero line names it.

## Frame 2 — Now where is it?

- scene: The heap jitters; a magnifying-glass cursor darts around failing to find anything; "Now where is it?" slams in big, tilted
- duration: 2.6s
- poster: 1.8s
- transition_in: cut
- status: animated
- src: compositions/frames/02-where.html
- asset_candidates: none (continues frame 1's chips)
- sfx: two quick "boop?" question blips, a cartoon shrug wobble

Same heap continues from frame 1 (handoff: chips stay put). Comic beat — the search fails.

## Frame 3 — Enter the star

- scene: The Tidymark star streaks in from the left with its speed lines, sweeps the heap off screen like a broom, spins to centre; wordmark and "Every bookmark in its place" stamp in
- duration: 3.6s
- poster: 2.8s
- transition_in: cut
- status: animated
- src: compositions/frames/03-star.html
- asset_candidates: project/logo.svg, project/promo-marquee.png (tagline + chip lockup reference)
- sfx: big whoosh on the sweep, sparkle shimmer as the star spins, a bright chord on the wordmark

The reveal. The real logo does the tidying — playful, on brand.

## Frame 4 — One click, the right folder

- scene: A browser window with the real popup screenshot slides in; a cursor clicks; the 94% "Dinners" suggestion pulses; the Save button is clicked and a "Weeknight lasagna" chip flies into a Dinners folder that gulps it
- duration: 5.4s
- poster: 3.6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-one-click.html
- asset_candidates: project/screenshot-1.png
- sfx: click, rising "bloop" as the bars fill, click on Save, whoosh, satisfying chime + folder thud

The core feature, shown with the actual UI.

## Frame 5 — No forced fits

- scene: The real "No folder fits well" popup (Lisbon itinerary); the "Create a new folder" button is pressed and a fresh lime folder named "Lisbon" pops out with sparkles
- duration: 4.2s
- poster: 3.0s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-no-fit.html
- asset_candidates: project/screenshot-2.png
- sfx: a gentle "hmm" two-note, click, pop + sparkle

Honesty beat: it suggests a new folder instead of guessing.

## Frame 6 — Four ways to sort the pile

- scene: Four folder-tab cards drop in a 2×2 grid, each playing its real explainer clip (A new folders, B your folders, C by usage, D projects); a spotlight cycles A→B→C→D, enlarging the active card
- duration: 10s
- poster: 4.0s
- transition_in: wipe
- status: animated
- src: compositions/frames/06-four-ways.html
- asset_candidates: mode-a-en.mp4, mode-b-en.mp4, mode-c-en.mp4, mode-d-en.mp4, project/screenshot-3.png
- sfx: four card drops (thud-thud-thud-thud), a soft click + tone per spotlight change in A-B-C-D colours

The breadth beat, carried entirely by the real clips.

## Frame 7 — Checkup

- scene: The real Checkup screen; stat cards count up; a broom swipe clears duplicate and empty-folder rows with a trash flip
- duration: 4.4s
- poster: 3.0s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-checkup.html
- asset_candidates: project/screenshot-4.png
- sfx: counter ticks, a broom swish, a paper crumple pop per row

Find what to delete, too.

## Frame 8 — Nothing moves until you press Apply

- scene: A move plan list; a big Apply button gets pressed and items fly to folders; then Undo is pressed and they rewind back
- duration: 3.6s
- poster: 2.4s
- transition_in: cut
- status: animated
- src: compositions/frames/08-safe.html
- asset_candidates: none (move-plan rows in the site's style: "One-bowl banana bread → Recipes / Baking" etc.)
- sfx: click, swoosh forward, click, reverse "rewind" sweep

Trust beat.

## Frame 9 — Add to Chrome

- scene: Paper canvas; the star bounces in, "Tidymark" and "Every bookmark in its place" lock up; a chunky "Add to Chrome" button and the tidy.tmtt.link pill; folder-colour confetti bursts
- duration: 4.2s
- poster: 3.0s
- transition_in: crossfade
- status: animated
- src: compositions/frames/09-cta.html
- asset_candidates: project/logo.svg, project/promo-marquee.png
- sfx: bounce boing, final resolving chord, confetti crackle

Close on the brand and where to get it.

## Video direction

- Look: frame.md (BlockFrame atoms on Tidymark's paper/ink/lime/sky/amber/violet). Light only.
- Motion: bouncy and springy (back/elastic outs), objects have weight; nothing static for more than ~1s.
- Sound: no voice-over. A 120 BPM bouncy music bed (marimba + bass + light drums) synthesized in JS; every visual hit has a matching SFX from the same script.
- Captions: skipped (no narration).
