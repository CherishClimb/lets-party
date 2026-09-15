# UI Design Specification — Unicorn Birthday Treasure Hunt

## Purpose

This file defines the **approved visual direction and UI behavior** for the birthday treasure-hunt web app.

Use this together with:

- `scope.md` — functional / technical requirements
- `story.md` — narrative / story flow
- `ui_design.md` — visual / interaction design

If there is a visual conflict, follow this file.

The functional game logic is already mostly correct.  
This UI pass should **improve atmosphere and presentation without redesigning the core game logic**.

---

# 1. Overall design direction

The app should feel like:

> **A warm magical birthday storybook that happens to be interactive.**

Target audience:

- children age 5–7
- parents / organizer

Style:

- magical
- warm
- cheerful
- birthday atmosphere
- clean
- modern
- cute
- gender-neutral
- not overly pink
- not princess-themed
- not a SaaS dashboard
- not visually crowded

The magic should come mainly from:

- illustrations
- soft light
- stars
- subtle sparkles
- clouds
- gentle rainbow accents
- warm birthday decorations
- rounded storybook shapes
- meaningful lightweight animation

Do **not** try to make the app flashy or technically complex.

---

# 2. Visual palette

Use a warm cream/off-white base instead of pure white.

Suggested palette:

- warm cream: `#FFF9EE`
- sky blue: `#DFF3FF`
- soft mint: `#DDF5E5`
- soft lavender: `#EDE2FF`
- warm yellow: `#FFE7A3`
- soft coral: `#FF9F8F`
- deep teal / green for primary actions: `#176B5B`
- dark readable text: `#203B39`
- magical gold accent: `#F6C84C`

Team colors:

- 👾 Little Monsters → lavender / soft purple
- 🐙 Little Octopuses → aqua / sky blue
- 🐊 Little Crocodiles → mint / green

Use team colors consistently for:

- card border
- team badge
- warm-up area
- reward accent
- progress highlight

Do not color the entire app by team.

---

# 3. Typography

Use:

- one friendly rounded display font for child-facing titles
- one highly readable sans-serif font for parent controls and instructions

Child-facing text:

- very short
- large
- high contrast
- easy to read from several meters away on TV

Parent-facing text:

- practical
- compact
- readable outdoors

Avoid:

- long paragraphs
- tiny labels
- too many text styles
- decorative fonts for body text

---

# 4. General layout principles

## Child-facing scenes

Use:

- one strong central illustration
- one short message
- one clear action
- lots of breathing room
- minimal UI chrome

Prefer full-screen or near-full-screen scene layouts.

Do not make child-facing screens look like dashboards or forms.

## Parent / organizer screens

Use:

- clear current mission
- compact rules
- team status
- completion controls
- magic progress

These screens can be more functional, but should still visually belong to the same magical world.

---

# 5. Background style

Avoid plain white.

Use warm, subtle backgrounds such as:

- cream
- very light blue
- very light mint
- very light lavender

Optional decorative layers:

- soft cloud shapes
- faint stars
- tiny sparkles
- gentle rainbow corner accent
- soft rounded hills
- very subtle gradient

Keep decoration low contrast.

Do not make backgrounds busy.

---

# 6. Cards and containers

Cards should feel like soft storybook panels rather than SaaS panels.

Use:

- rounded corners
- thin soft borders
- subtle shadow
- gentle background tint
- generous padding

Avoid:

- sharp rectangles
- strong gray borders
- dense data-card styling
- too many nested cards

---

# 7. Buttons

Primary buttons should be:

- large
- rounded
- highly readable
- visually warm
- suitable for touch

Recommended primary style:

- deep teal / green
- light text
- subtle glow or soft shadow

Examples:

- **ABENTEUER STARTEN**
- **WEITER**
- **ZAUBERKRAFT VERLEIHEN**
- **ZAUBERWÖRTER VERBINDEN**
- **SCHATZ GEFUNDEN**
- **FINALE STARTEN**

Secondary organizer controls should be visually quieter.

Do not give every control the same visual weight.

---

# 8. Magic powers — core visual motif

The three magical powers must look consistent throughout the app:

- ⭐ **Mut**
- 🌈 **Zusammenhalt**
- 💎 **Klugheit**

Treat them as a recurring visual system.

On parent screens, use a compact progress strip:

`⭐ Mut   🌈 Zusammenhalt   💎 Klugheit`

States:

- uncollected → faded / low opacity
- collected → full color + subtle glow

When a team earns a symbol:

- show it large
- short glow / sparkle animation
- visually move or transition it into the team’s collection
- keep animation short

These moments are important child-facing reward moments.

---

# 9. Home screen

The current home page should feel less like a website and more like the beginning of a birthday adventure.

## Layout

Top small label:

**LUCYS 6. GEBURTSTAG**

Large title:

# **Ein magisches Abenteuer beginnt …**

Short subtitle:

**„Heute braucht das Geburtstags-Einhorn eure Hilfe.“**

Main visual:

- happy unicorn
- soft magical landscape
- light birthday elements such as balloons / stars / subtle confetti
- warm storybook atmosphere

Primary button:

# **ABENTEUER STARTEN**

Below:

three team preview cards:

- 👾 Kleine Monster
- 🐙 Kleine Oktopusse
- 🐊 Kleine Krokodile

Each card should show the mascot prominently.

Remove or visually de-emphasize:

- marketing-style statistics
- “3 Rettungsteams / 3 Abenteuer / 1 Einhorn”
- multiple equally strong call-to-action buttons

Organizer setup should become a quieter control such as:

**⚙ Vorbereitung**

---

# 10. Team setup / team view

This screen is more practical but should remain warm.

Use three clearly separated team areas.

Each team area contains:

- mascot
- team name
- 4 child slots
- child icon
- child name

Suggested visual:

- Monster card → lavender
- Octopus card → soft blue
- Crocodile card → mint

Names should feel like small name badges rather than spreadsheet rows.

On tablet / TV:

- show all three teams side by side if space allows

On phone:

- stack vertically

---

# 11. Team reveal

This is child-facing.

Show:

- one strong mascot per team
- team name
- the 4 child names/icons clearly
- soft celebratory sparkles / stars

The screen should feel like:

> “These are your adventure teams!”

Keep controls minimal.

---

# 12. Team warm-up / pose section

This uses the **accepted cartoon pose images already saved in the project**.

Do not redraw them.

Each team completes **all 3 poses**.

There is no pose selection.

Each team should have 3 pose cards under its team section.

## Little Monsters

1. Monster-Krallen
2. Monster-Turm
3. Monster-Brüllen

## Little Octopuses

1. 8 Tentakel
2. Oktopus-Welle
3. Oktopus-Kugel

## Little Crocodiles

1. Schnapp-Krokodil
2. Krokodil-Zug
3. Krokodil-Schleich

## Pose card design

Each card contains:

- saved pose image as the dominant element
- very short label
- one button:

**Fertig**

When pressed:

- mark pose completed with a small checkmark
- update progress such as `1 / 3`, `2 / 3`, `3 / 3`

After all three:

**„Alle 3 Posen geschafft!“**

or:

**„Team-Zauber geschafft!“**

For MVP:

- no camera function
- no photo storage
- no image upload required

On tablet / TV:

- show 3 pose cards horizontally

On phone:

- stack vertically or use a simple swipe/carousel

Prefer one team at a time during the pose activity to avoid showing all 9 cards at once.

---

# 13. Story intro

The story scenes should be visually immersive and image-led.

Use:

- large illustration
- one short line of text
- minimal controls
- simple scene transitions

The intro should not look like normal web content.

Suggested atmosphere:

- first scenes → warm birthday forest
- storm scene → darker blue/purple magical atmosphere
- rescue team reveal → bright / hopeful again

Use only lightweight animation:

- drifting clouds
- stars
- sparkles
- fade
- slide
- subtle storm movement

No heavy animation libraries.

---

# 14. Outdoor mission screens — parent view

These are mainly for organizer/parents.

They should be efficient.

## Recommended structure

Top:

- back button
- magic progress strip:
  - ⭐ Mut
  - 🌈 Zusammenhalt
  - 💎 Klugheit

Main mission area:

- level title
- one small illustration
- short rules
- current level number

Below:

three team status cards:

- mascot
- team name
- completion state
- collected symbols

Action:

**Aufgabe geschafft**

or equivalent.

Keep these screens visually lighter and simpler than child story scenes.

Do not over-decorate.

---

# 15. Reward screen — child mode

After a team completes a level, temporarily show a strong child-facing reward screen.

Example:

# **Super gemacht!**

Large symbol:

⭐

Short message:

**„Die kleinen Monster haben MUT gefunden!“**

Visual:

- team mascot
- large glowing symbol
- sparkles
- subtle celebratory background

Duration:

- short
- clear
- magical

Then return to organizer mode.

---

# 16. Level 2 transition

The app should visually show that the storm returns.

Use:

- light wind animation
- one mat visually flying away

Large text:

# **NUR NOCH 4 MATTEN!**

Keep this short and playful.

---

# 17. Level 3 word reveal

The reveal should feel more mysterious than the other screens.

Use:

- darker magical forest / deep blue-green scene
- glowing letter tiles
- subtle crystal / sparkle accents

Show:

**BREIT**

**WIESEN**

**SCHULE**

Then button:

**ZAUBERWÖRTER VERBINDEN**

Animate them combining into:

# **BREITWIESENSCHULE**

Then reveal:

# **HOF**

Do not show unrelated words such as “REGENBOGEN”.

This screen is one of the key magical moments.

---

# 18. Piñata mission

Keep this child-facing screen extremely simple.

Use:

- treasure / magical trail illustration
- warm schoolyard / adventure feeling

Large text:

# **SUCHT DEN EINHORN-SCHATZ!**

One organizer button can remain discreetly available.

After discovery:

# **SCHATZ GEFUNDEN!**

Then show the story text from `story.md`.

---

# 19. Return-home waiting screen

This should be calm and magical.

Show only:

⭐ Mut  
🌈 Zusammenhalt  
💎 Klugheit

Text:

**„Alle drei Zauberkräfte sind sicher.“**

Subtext:

**„Aber das letzte Geburtstagsgeheimnis wartet noch …“**

Visual:

- soft glowing background
- slow floating stars / powers
- no busy controls

---

# 20. Finale

This is the strongest magical scene in the app.

Use:

- warm sky
- birthday light
- glowing magic
- the unicorn returning
- the three symbols flying together

Show:

⭐ + 🌈 + 💎

Then:

# **IHR HABT ES GESCHAFFT!**

The finale should feel joyful and emotional, not technically complex.

Use simple:

- scale
- glow
- fade
- sparkle
- confetti

---

# 21. Final birthday screen

Use the supplied **Lucy + unicorn PNG** as the main hero visual.

Do not redraw or recreate it.

The final screen should be clean and beautiful.

Main text:

# **Alles Gute zum 6. Geburtstag, Lucy!**

Side panel:

## **Unsere Helden:**

Then dynamically list all participating child names from the app state.

Do not hard-code names.

Keep additional text minimal.

This screen should be:

- suitable for TV projection
- suitable as a birthday memory/photo background
- visually celebratory
- warm and elegant
- not cluttered

---

# 22. Mascot consistency

The three mascots must remain clearly identifiable everywhere.

## Monster

- soft purple
- cute
- friendly
- playful
- clearly monster

## Octopus

- soft blue / aqua
- clearly octopus
- round and friendly

## Crocodile

- green
- clearly crocodile
- long snout
- visible tail
- crocodile silhouette
- not hippo-like
- not frog-like

Do not overcomplicate mascot drawings.

Simple and recognizable is better than detailed and confusing.

---

# 23. Animation rules

Use animation only where it adds magic.

Good uses:

- drifting clouds
- floating stars
- subtle sparkle
- symbol glow
- mascot bounce
- reward pop
- mat flying away
- letter tiles combining
- finale symbols returning
- final confetti

Avoid:

- constant motion
- heavy libraries
- large parallax systems
- 3D
- canvas engines
- distracting transitions

Animations must never block navigation.

---

# 24. Responsive behavior

## Phone

- single column
- large touch targets
- no horizontal scrolling
- pose cards can stack or swipe

## Tablet / iPad

- primary party device
- larger illustrations
- 2–3 columns where useful
- pose cards in a horizontal row

## TV / laptop

- large readable typography
- strong centered scenes
- team cards side by side
- final screen optimized for projection

---

# 25. MVP constraints

Do not add:

- new game mechanics
- extra story branches
- new backend
- login
- complex animation systems
- photo storage
- video
- new libraries unless absolutely necessary

Do not modify:

- level logic
- progress logic
- reward logic
- localStorage structure
- finale unlock conditions

unless required to fix an actual bug.

The goal of this pass is:

> **Make the existing app feel like a warm magical 6th birthday adventure without making the codebase larger or more complex.**

---

# 26. Priority order for UI implementation

Implement in this order:

1. overall palette / typography / page background
2. home screen
3. team cards / mascots
4. team warm-up using the saved pose images
5. story intro scene styling
6. outdoor parent mission layout
7. reward screen
8. Level 2 transition
9. Level 3 reveal
10. piñata screen
11. waiting screen
12. finale
13. final birthday screen
14. responsive polish
15. small animation polish

---

# 27. Final design principle

The final app should feel like:

> **a beautiful modern children’s birthday storybook with interactive moments**

not:

> a dashboard decorated with cartoon icons.

Keep it warm, magical, readable, simple, and emotionally celebratory.
