# Unicorn Treasure Hunt Web App — MVP Scope

## 1. Goal

Build a small responsive web app for a **5–7 year old unicorn treasure hunt**.

It should work well on:

- phone
- iPad / tablet
- laptop
- TV/projector via screen mirroring or HDMI

The app is a **visual party guide + team/progress tracker**.  
The physical games still happen outside.

The organizer/parent controls the flow.

**MVP target:** simple enough for Codex to build in about **6 hours**.

---

## 2. Core game structure

The adventure has exactly **3 levels**:

1. **Level 1 — Rainbow Path with 5 mats**
2. **Level 2 — Rainbow Path with 4 mats**
3. **Level 3 — Search for letters / word puzzle**

After a team completes a level, the organizer awards that team **one magic symbol**.

Each team needs **3 symbols total**.

When all 3 teams have all 3 symbols, the finale is unlocked.

---

## 3. Teams

There are exactly 3 teams.

### Team 1
**Die kleinen Monster**

Mascot: cute little monster

### Team 2
**Die kleinen Oktopusse**

Mascot: cute small octopus

### Team 3
**Die kleinen Krokodile**

Mascot: cute crocodile

Default for 12 children:

- 4 children per team

The organizer must be able to assign or move children between teams before the game starts.

---

## 4. Child setup before the party

The organizer can enter all children's names beforehand.

Support approximately 6–15 children.

Each child has:

- name
- icon
- team

Suggested child icons:

- star
- moon
- rainbow
- heart
- cloud
- sun
- diamond
- flower
- butterfly
- lightning
- magic wand
- leaf
- comet
- crown
- gem

Use large simple icons.

Store all setup data in `localStorage`.

No login.

No backend.

---

## 5. Team reveal screen

At the beginning, all children gather around the iPad / TV.

The app shows all entered children.

Each child should be able to visually find:

- their name
- their icon
- their team

Then show a short animated team reveal.

Display all 3 teams clearly:

- mascot
- team name
- child names
- child icons

On iPad / TV, show all 3 teams side by side if possible.

On phone, stack vertically.

Organizer presses:

**Weiter**

---

## 6. Intro story

Use a very short animated story before the game starts.

Maximum duration:

**30–45 seconds**

No video required.

Use simple CSS animations and illustrated cards.

### Scene 1

Text:

**„Im Zauberland lebte ein kleines Einhorn.“**

Show a happy unicorn.

### Scene 2

Text:

**„Doch plötzlich kam ein großer Zaubersturm!“**

Show moving clouds / wind / sparkles.

### Scene 3

Text:

**„Drei Zauberzeichen gingen verloren.“**

Show 3 magic symbols flying away.

Recommended symbols:

- ⭐ Stern
- 🌈 Regenbogen
- 💎 Zauberstein

### Scene 4

Text:

**„Nur drei mutige Teams können die Zauberzeichen zurückbringen.“**

Then:

**„Seid ihr bereit?“**

Button:

**JA! ABENTEUER STARTEN**

Organizer can:

- skip intro
- replay intro

---

## 7. Team warm-up

Before Level 1, each team chooses one team gesture.

Show 3 predefined gesture cards per mascot.

### Little Monsters

1. Monster-Krallen
2. Monster-Brüllen
3. Monster-Sprung

### Little Octopuses

1. Oktopus-Arme
2. Oktopus-Welle
3. Oktopus-Stern

### Little Crocodiles

1. Krokodil-Schnapp
2. Krokodil-Schleich
3. Krokodil-Power

The team taps one gesture.

Then show:

**„3 – 2 – 1 – TEAMFOTO!“**

Provide button:

**📷 Erinnerungsfoto machen**

For MVP use:

```html
<input type="file" accept="image/*" capture="environment">
```

Do not build an advanced camera system.

The photo feature is optional and must never block gameplay.

---

# 8. Level system

All 3 levels should reuse the same visual component structure.

Each level screen contains:

- level number
- title
- short story sentence
- short organizer explanation
- large child-friendly rule card
- 3 team status cards
- one completion button per team
- symbol progress
- next-level button

The organizer controls everything.

A team completion button:

**✓ Aufgabe geschafft**

When tapped:

- show sparkle/check animation
- award that team the current level symbol
- update progress
- allow undo

The next level becomes available when all 3 teams have completed the current level.

Do **not** auto-advance.

---

# 9. Level 1 — Regenbogenweg: 5 Matten

## Purpose

Easy first teamwork challenge.

Each team has:

- 4 children
- 5 foam mats

## Story text

**„Der Regenbogenweg ist kaputt. Könnt ihr gemeinsam ans andere Ufer kommen?“**

## Child-friendly rules

Show only:

**Level 1 — 5 Matten**

- Ihr dürft den Boden nicht berühren.
- Bleibt als Team zusammen.
- Gebt die hintere Matte nach vorne.
- Kommt gemeinsam ans Ziel.

Keep text very large and visual.

Optionally show a simple illustration:

4 children + 5 mats.

## Completion

When a team finishes physically, organizer taps:

**✓ Aufgabe geschafft**

## Reward

Award:

⭐ **Stern**

Animate star into that team's progress row.

---

# 10. Level 2 — Regenbogenweg: 4 Matten

## Purpose

Same game, harder version.

Each team now has:

- 4 children
- only 4 foam mats

## Story text

**„Oh nein! Der Zaubersturm hat eine Regenbogenmatte weggeweht!“**

Then:

**„Schafft ihr den Weg jetzt auch mit nur 4 Matten?“**

## Child-friendly rules

- Ihr dürft den Boden nicht berühren.
- Jetzt habt ihr nur 4 Matten.
- Helft euch gegenseitig.
- Kommt wieder gemeinsam ans Ziel.

Use the same visual style as Level 1.

The difference should be obvious:

**5 → 4 mats**

## Completion

Organizer taps:

**✓ Aufgabe geschafft**

## Reward

Award:

🌈 **Regenbogen**

Animate the rainbow into that team's progress row.

---

# 11. Level 3 — Buchstaben-Schatzsuche

## Purpose

Final outdoor treasure hunt.

The 3 teams search for physical puzzle pieces / letters.

Each team finds one part of the destination name.

### Team 1 — Little Monsters

Finds:

**BREIT**

### Team 2 — Little Octopuses

Finds:

**WIESEN**

### Team 3 — Little Crocodiles

Finds:

**SCHULE**

The organizer prepares the physical letters/puzzle pieces beforehand.

The app does **not** need to generate printable cards.

The app only shows:

- which team searches for which word
- a simple visual empty word area
- team completion

---

## Level 3 screen

Title:

**Level 3 — Die Buchstaben-Schatzsuche**

Story text:

**„Das Einhorn hat uns eine letzte Spur hinterlassen.“**

Then:

**„Jedes Team muss sein Zauberwort finden!“**

Display 3 big team cards.

### Monster team

**Sucht das Wort:**

`_ _ _ _ _`

Label:

**BREIT**

For organizer use only; child mode may hide the answer if preferred.

### Octopus team

`_ _ _ _ _ _`

Label:

**WIESEN**

### Crocodile team

`_ _ _ _ _ _`

Label:

**SCHULE**

Each team physically searches for its puzzle pieces.

When found, organizer taps:

**✓ Wort gefunden**

---

## Level 3 reveal

When all 3 teams have completed:

Animate the three words separately:

**BREIT**

**WIESEN**

**SCHULE**

Then slide them together:

# BREITWIESENSCHULE

Pause briefly.

Then reveal:

# HOF

Final message:

**„Ihr habt den nächsten Ort gefunden!“**

Then:

**„Auf zum Breitwiesenschule-Hof!“**

## Reward

Award:

💎 **Zauberstein**

Now each completed team has:

⭐ 🌈 💎

---

# 12. Progress screen

Accessible at any time.

Title:

**Unsere Zauberkraft**

Show 3 team cards.

Example:

### Die kleinen Monster
⭐ 🌈 💎  
**3 / 3**

### Die kleinen Oktopusse
⭐ 🌈 □  
**2 / 3**

### Die kleinen Krokodile
⭐ 🌈 💎  
**3 / 3**

If one team has 3/3:

**Bereit fürs Finale!**

If all teams have 3/3:

show large button:

**FINALE FREISCHALTEN**

Do not start automatically.

---

# 13. Finale at home

After the outdoor treasure hunt, everyone returns home.

A real unicorn balloon will be waiting there.

The app provides the final magical animation.

Organizer taps:

**Finale starten**

---

## Finale animation

Duration approximately:

**20–30 seconds**

### Scene 1

Show the unicorn looking weak/sad.

Text:

**„Das Einhorn wartet auf seine verlorene Magie …“**

### Scene 2

Show all collected symbols:

⭐ + 🌈 + 💎

Animate them moving toward the unicorn.

### Scene 3

Unicorn becomes colorful / happy.

Add sparkles.

Text:

**„Ihr habt meine Magie zurückgebracht!“**

### Scene 4

Thank the teams:

**„Danke, kleine Monster!“**

**„Danke, kleine Oktopusse!“**

**„Danke, kleine Krokodile!“**

Then large title:

# IHR HABT DAS EINHORN GERETTET!

Use simple confetti animation.

### Final physical-world cue

Show:

**„Aber wartet …“**

Pause approximately 1–2 seconds.

Then:

**„Das Einhorn ist ganz in eurer Nähe!“**

Then very large:

# FINDET DAS EINHORN!

This should cue the children to look for the real unicorn balloon.

Optional final button:

**🎉 Geschafft!**

Final message:

**„Gemeinsam sind wir magisch.“**

---

# 14. Organizer controls

A small organizer button / gear icon should be available on every screen.

Open a simple modal or side panel.

Controls:

- previous screen
- next screen
- jump to Home
- jump to Team Reveal
- jump to Level 1
- jump to Level 2
- jump to Level 3
- jump to Finale
- edit child names
- change child team
- mark/unmark team completion
- view progress
- replay intro
- replay finale
- reset game

Reset requires confirmation:

**„Wirklich alles zurücksetzen?“**

No password required for MVP.

---

# 15. Presentation / TV mode

Do not implement Chromecast or casting APIs.

The app only needs to display correctly when screen-mirrored or connected by HDMI.

Add button:

**📺 Präsentationsmodus**

When enabled:

- hide small organizer controls
- enlarge typography
- maximize team cards / story visuals
- center content
- use the full screen well

Organizer must still have an obvious way to exit presentation mode.

---

# 16. Responsive requirements

## Phone

- single-column
- large buttons
- thumb-friendly
- no horizontal scrolling

## iPad / tablet

- primary shared display
- larger cards
- 2–3 columns when useful

## Laptop / TV

- large readable text
- 3 team cards side by side
- generous spacing
- maximum clarity from several meters away

---

# 17. Visual design

Audience:

**5–7 years**

Style:

- cute
- clean
- magical
- modern
- friendly
- gender-neutral
- not too girly

Use:

- sky blue
- mint
- soft yellow
- lavender
- coral accents
- cream / white backgrounds

Visual elements:

- clouds
- stars
- sparkles
- rainbows
- gentle magical glows
- rounded cards

Mascots:

- cute monster
- cute octopus
- cute crocodile
- unicorn

All should use one consistent illustration style.

Avoid:

- excessive pink
- princess theme
- visually busy backgrounds
- tiny text
- long paragraphs

---

# 18. Technical implementation

Preferred simple structure:

```text
/index.html
/styles.css
/app.js
/assets/
```

Vanilla HTML/CSS/JavaScript preferred.

React is acceptable only if it makes development faster.

No backend.

No database.

No authentication.

No external APIs during gameplay.

Use:

```js
localStorage
```

for persistence.

Store:

- child names
- child icons
- team assignment
- chosen team gesture
- level completion
- collected symbols
- current screen
- intro completion

---

# 19. Suggested state model

```js
const gameState = {
  children: [
    {
      id: "child-1",
      name: "Emma",
      icon: "star",
      teamId: "monster"
    }
  ],

  teams: {
    monster: {
      name: "Die kleinen Monster",
      gesture: null,
      completedLevels: [false, false, false]
    },

    octopus: {
      name: "Die kleinen Oktopusse",
      gesture: null,
      completedLevels: [false, false, false]
    },

    crocodile: {
      name: "Die kleinen Krokodile",
      gesture: null,
      completedLevels: [false, false, false]
    }
  },

  currentScreen: "home",
  introCompleted: false,
  finaleUnlocked: false
};
```

Save after every meaningful change.

---

# 20. Animation scope

Only lightweight CSS animations.

Allowed:

- fade
- slide
- bounce
- pulse
- sparkles
- confetti
- symbol flying into progress slot
- simple cloud/storm movement

Do not implement:

- 3D
- game engine
- canvas physics
- complex character rigs
- video generation
- animation libraries unless absolutely necessary

Animations must never block navigation.

---

# 21. Audio

Audio is optional.

MVP must work perfectly without it.

If quick to add, support local files for:

- magic sparkle
- task success
- finale

No streaming audio.

---

# 22. Language

All user-facing text:

**German**

Code and comments:

English is fine.

Child-facing text should be very short.

Organizer instructions can be slightly longer.

No multilingual system needed.

---

# 23. MVP priority order

Codex should implement in this order:

1. Responsive shell / navigation
2. Child setup
3. Team assignment
4. Team reveal
5. Intro story
6. Warm-up gesture selection
7. Reusable level component
8. Level 1 — 5 mats
9. Level 2 — 4 mats
10. Level 3 — letter search
11. Team progress + symbols
12. Finale
13. Organizer controls
14. Presentation mode
15. Small animations
16. Photo button if time remains

---

# 24. Explicit non-goals

Do NOT build:

- user accounts
- cloud sync
- database
- chat
- multiplayer networking
- GPS
- map integration
- scoring leaderboard
- timers unless trivial
- complex sound system
- advanced camera
- printable puzzle generator
- custom animation engine
- app-store packaging
- payments
- admin backend

---

# 25. Definition of done

The MVP is done when:

1. Organizer can enter child names before the party.
2. Children can see their names, icons and teams.
3. The 3 mascot teams are visible.
4. Each team can choose a warm-up gesture.
5. The intro story can be played.
6. Level 1 clearly explains the 5-mat Rainbow Path.
7. Organizer can mark each team complete.
8. Level 2 clearly explains the 4-mat Rainbow Path.
9. Organizer can mark each team complete.
10. Level 3 clearly runs the BREIT / WIESEN / SCHULE letter search.
11. The app reveals BREITWIESENSCHULE HOF when all 3 teams finish.
12. Each team can collect ⭐ 🌈 💎.
13. Progress persists after page refresh.
14. Finale unlocks only when all 3 teams have 3/3 symbols.
15. Finale animation thanks the teams and tells children to find the real unicorn.
16. App is usable on phone, iPad and TV.
17. Organizer can undo accidental progress.
18. App works without a backend.

---

## Key product principle

**Keep the digital app simple. The children should spend most of their time moving, searching, cooperating and playing in the real world. The app creates story, structure, team identity and magical feedback — it should never become the main activity.**
