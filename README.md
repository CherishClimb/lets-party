# Die Einhorn-Rettung

Local German-language party guide following the functionality in `scope.md`, the final storyline in `story.md`,
and the approved storybook interface in `ui_design.md`. Vanilla HTML/CSS/JavaScript; no build step,
backend, accounts, external fonts, APIs, or runtime dependencies.

## Run

Open `index.html` directly for a quick start. For a consistent browser-storage
address, serve this folder with Python:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/ and keep using the same browser/address for the party.
For an iPad on the same Wi-Fi, serve with `--bind 0.0.0.0` and use the computer's
LAN IP instead of 127.0.0.1. Windows may ask to allow private-network access.
The computer must stay on. The TV simply mirrors the organizer's device.

The app opens with the four-digit **Zaubercode `0606`**. The organizer can replace
it under **Spielleitung → Zaubercode**. The selected code stays on that device;
successful entry keeps the current browser tab unlocked until its session ends.

## Party flow

1. Choose 6–15 child slots, fill the names, choose icons, and adjust teams. Empty places are fine.
2. Reveal the teams and play the birthday intro (about 74 seconds of content,
   ending at the rescue invitation). The warm-up shows one team at a time. Each team
   tries its three illustrated poses, taps **Wir haben alle ausprobiert ✨**, then
   chooses and confirms its official team pose. Activity progress and each team's
   choice are saved; returning teams can change their pose.
3. Run the first mat challenge with one more mat than children in each team. Every completed team gets a Mut reward moment.
   The last team's moment also celebrates MUT IST ZURÜCK.
4. Show the storm transition and run the second challenge with one mat per child for Zusammenhalt.
5. Show the secret-clue transition and run the physical word search. Words remain
   hidden on task cards. Gather the children and press ZAUBERWÖRTER VERBINDEN.
   The words combine, HOF appears, and all teams receive Klugheit.
6. At the schoolyard, show SUCHT DEN EINHORN-SCHATZ. Confirm SCHATZ GEFUNDEN,
   give the children their piñata prizes, then explicitly reveal the unicorn's
   return message. The app pauses on the calm return-home waiting screen.
7. At home, prepare the balloon and manually start the finale. At FINDET MICH,
   children discover it. Press EINHORN GEFUNDEN to celebrate the rescue.
8. Reveal the three team snacks, then show the final birthday screen with the
   transparent Lucy + unicorn cutout and the participating children's names under **Unsere Helden:**.

Presentation mode enlarges the display and hides organizer controls. Use its
visible exit button to mark tasks or open the organizer panel. The panel offers
navigation, editing, progress, replay, completion undo, and confirmed full reset.

## Edit the wording

All German copy lives in `content.js`: names, powers, rules, scenes, buttons,
destination and rewards. Edit quoted strings; retain IDs and the three-team/level
structure. Scene durations use milliseconds. The finale runs about 34 seconds.
The intro waits for the organizer at its final invitation. Navigation stays usable.

- `index.html`: document shell.
- `content.js`: editable content and scene definitions.
- `game.js`: state validation and progression.
- `app.js`: rendering, events, scene scheduling and persistence.
- `styles.css`: responsive design, supplied team-character crops, the CSS unicorn and lightweight motion.
- `ui_design.md`: approved visual and interaction direction.
- `tests/game.test.cjs`: dependency-free state and simulated UI-flow tests.

## Persistence and limits

Setup, gestures, completions, clue reveal, schoolyard milestones, current screen,
rescue confirmation and reward position save after meaningful changes. Symbols and finale eligibility derive
from completion flags and the combined-clue reveal. Undo relocks ineligible screens and preserves other work.
Refreshing restarts an active animation from its first scene, preserving progress.
Existing version-1 saves migrate automatically, preserving names and progress.
There is no device sync.

The MVP does not open a camera, upload files, or store photos. Individual pose checks
live only for the open session; finishing all three poses records team readiness in
the existing state.

No service worker/PWA cache: reopening or refreshing needs access to the local
files or static server. Audio is omitted. No GPS, digital puzzle, or extra lore.

## Validation

With Node.js (development only):

```powershell
node --test tests/game.test.cjs
```

Tests cover all 512 completion combinations, gates, undo, persistence, malformed
and unavailable storage, safe names, the complete simulated party flow, animation
pause/cancellation, reward gating, photo input, team edits, and reset.
These tests simulate the DOM; they do not replace real-browser testing.

Before the party, check the actual phone/iPad and mirrored TV:

- Readable text, no phone overflow, and accessible presentation-mode exit.
- Camera selection and saving on that device.
- Refresh recovery using the same browser address.
- Full rehearsal through the clue, piñata, prizes, return message, finale, balloon, snacks and birthday image.

Visual browser QA was unavailable during implementation: no browser was connected.
`scope.md` and `story.md` are preserved. The final story supersedes earlier narrative
wording and timings. The final screen uses `Assets/lucy-unicorn-cutout.png`, extracted locally from the supplied image.
Only the alpha mask and crop were changed; visible RGB pixels remain identical to the original.
It is a real RGBA PNG (726 × 1220), with no generated replacement scene.
The final screen shows only the birthday greeting, **Unsere Helden:** and the entered names,
plus discreet icon-only organizer controls. Extraction tools are development-only; the app
has no new runtime dependencies.
Team views use the original `Assets/team-characters.png` artwork and CSS crops for the
pink octopus, green crocodile and blue one-eyed monster. Warm-up pose cards use the
nine supplied pose PNGs without changing them.
