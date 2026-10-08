# Wobblins: what changed overnight (Oct 8)

Nothing here needs you to act. If you only have a minute, open the game and start a new colony.

**Try it:** run `node server.js` in `C:\Users\ignit\woblins`, then open:

- `http://localhost:8137/?debug=1&fresh=1` starts a brand-new colony (the new-player flow).
- `http://localhost:8137/?debug=1&devload=/_dev_save.json` loads a 300-day village with every power unlocked.

Sound plays after your first tap; the speaker button (top left) mutes it. The **?** button explains every gesture. Everything is committed in the local git repo, and all 14 test files pass.

## 1. Art

- **The valley is painted on a canvas.** It has alpine mountains with sunlit faces, snow and gullies, shaded clouds that change colour with the time of day, haze, and grass. Tall grass sways in the foreground, and rain splashes ripple on the ground.
- **Light falls on everything.** At night the Wobblins and huts dim with the moonlight while doorways and fires glow warm; dusk turns everything rosy. A cold snap paints the ground snowy.
- **New art for every object.** Huts, the totem and the temple are drawn at Wobblin scale, so a hut looks big enough to live in. The temple looks Wobblin-built: stacked stones, carved posts, a leaf-thatch roof, prayer flags and a sun disc. Murals are painted slabs with handprints.
- **The world shows its history.** Dirt paths wear in wherever the Wobblins walk most, and grass grows back over paths they stop using. Chimney smoke appears once they know Hearth. Bunting goes up for a festival, notes float over a song, and a glowing ring marks a fire or rain dance.
- **Wobblins look more individual.** Each has its own body build. Their brows show temperament (worried, determined, one brow raised, calm), elders carry a cane, and keepsakes are worn as charms. Happy ones keep their eyes open, big and shiny, and their eyes follow your hand.
- **A painted icon for each of the 30 discoveries,** in the Discovery Book and on the eureka card. Undiscovered pages show only a faint silhouette.
- **New screens.** There's a title screen at dawn with three sleeping Wobblins, a wooden tray, a glass HUD and a rounded display font (Fredoka).

## 2. Deeper Wobblins

- **Seven stats out of 10,** including a new one, Caution. Every Wobblin starts different, and the stats drift with what happens to them.
- **Five skills that level up:** foraging, building, tinkering, exploring and storytelling.
- **You can watch stats change.** When a Wobblin gets braver, warier or better at something, it says so over its head ("Bravery 7 ▲", "Foraging 4!"). A boulder on the head, for example, shows "Caution 5 ▲".
- **Discoveries need the right temperament.** Huts and walls need a Wobblin who worries enough, fire needs a brave one, and the temple needs a devout one. Each Wobblin's card lists what it could work out if it had more of a trait.
- **Breeding works.** A baby takes after one parent or the other in each trait, with an occasional surprise, and a card shows what it inherited. To breed for a trait, drop one Wobblin onto another for a hug: they stay together, and close friends pair up far sooner (in a test, the first pair formed after 11 days instead of 25).
- **Friends, rivals and squabbles** form on their own. The Family panel shows every generation.
- **Each Wobblin talks.** Its card shows one line in its own voice, drawn from its real memories ("A boulder squashed me flat. I'm fine. Mostly."), and it babbles the line in a little made-up voice. This is a placeholder for the AI layer and follows the same grounding rule.
- **They ask you for things,** from day one: berries when they're hungry, a friend when they're lonely, rain in a dry spell, stones to stack, flowers. A golden bubble shows what they want and the top of the screen says how to help. Granting an ask gives belief; ignore it and they give up after a while.
- **They remember how you treat them.** One that trusts you snuggles into your hand and waves hello when your hand passes over; one you've scared or flung around struggles, or covers its head. They also give you a name from what you do most (the Rainmaker, the Thrower, the Gentle Hand...), said fondly or nervously.
- **Tap a Wobblin's name to rename it.** When one dies, a quiet goodbye card says what it knew and who will miss it.

## 3. Freedom and funny chain reactions

All of these replay exactly and never teach the Wobblins anything.

- **Drop or fling a Wobblin onto something:**
  - onto a friend: a hug
  - into someone: a bowling-ball knockdown, and a grudge
  - into a berry bush: every berry squashed
  - into a tree: stuck, and a seed shakes loose
  - into the fire: bold ones walk through it; timid ones run screaming into the river
  - through a hut roof: the hut needs rebuilding
  - onto the frozen pond: skating
  - into a snowman: poof
  - into the river: bold ones swim it, a friend on the bank wades in to the rescue, and everyone else is swept downstream (sometimes coming out with a fish). They drip and shiver for a while.
  - into a mural: covered in paint, with a Wobblin-shaped smudge on the mural; the artist is cross and repaints it later
  - into the garden: the crops are flattened for a while and the gardeners are cross
- **Catch a flung Wobblin in mid-air** and throw it again to juggle it. The playful shriek with joy; the rest go green.
- **Hold one still** and it dozes off in your hand. **Shake it** and it wobbles like jelly and stays rattled. **Poke it over and over** and it giggles, gets cross, then runs off.
- **They see it coming.** Hover lightning or a boulder over them and the timid brace and sweat while the bold bounce with excitement; hover seeds or a gift and they all perk up.
- **Drop powers on a Wobblin's head:**
  - stones: a bonk, which sometimes knocks an idea loose
  - a boulder: squashed flat. It can hurt, but never kills.
  - a seed: a flower crown, with a butterfly
  - lightning: frizzy fur, and sometimes a bright idea. The static shock spreads to anyone they bump into.
  - the daily gift: they catch it
- **The others react to who it hit.** A close friend winces and runs over to hug them better; a rival enjoys the show; playful ones laugh.
- **Lightning on things:** it splits boulders into stones, blows cairns apart, makes a totem hum (the devout take it as a sign), stuns fish in the river, and cracks a frozen pond under anyone skating on it.
- **Cold snaps** freeze the pond. Add rain and you get snow, and the playful ones build snowmen.
- **New power, Shake the Valley** (unlocks at belief 26): berries rain down, cairns topple, old walls fall, a boulder on the hill may come rolling down into the valley (everyone dives out of the way), the screen shakes, and timid Wobblins never forget it.
- **Pick things up:** drag stones, gifts, curios, sprouts or clay to a new spot.
- **Room to play:** the valley has 35 open spots instead of 30, and it tidies itself (keepsakes get taken home, spare stones get used). Stones dropped on a small pile make it bigger, and stones or seeds still land on a head when the valley is full.

## 4. A reason to play

- **You can see belief grow:** every act that delights them floats a "+1.6 belief" up from where it happened, and the belief bar flashes (scaring them shows a red minus).
- **Ages and 15 milestones** (the Goals button). Examples: tame fire, welcome a baby, three generations, a temple. Claiming one gives belief, and belief unlocks powers.
- **A fast start:** while you watch a new colony, its first 12 days pass at 20 seconds each, then slow to a day a minute. The first discoveries, asks and unlocks arrive within a few minutes.
- **Each new power gets a banner** with its icon when belief unlocks it, and its tray tile glows until you try it.
- **A first-time coach** gives four pointers (drag stones in, pick a Wobblin up, watch them think, claim a goal), then gets out of the way.
- **Big moments get their own card:** a discovery with confetti and what it means, a baby and who it takes after, a goodbye. They queue one at a time. A live ticker in the corner shows the day's most interesting happening.
- **Coming back after a while,** the recap shows who each line is about and includes friendships and squabbles. In 85-97% of 8-hour absences there are now 3 or more changes, up from 63-93%. The Chronicle has a "Their story" tab with a face on every line.

## 5. Feel

- **Synthesized sound** for every action: pops, boings, splashes, zaps, rumbles, giggles and a eureka chime, plus quiet ambience (birds by day, crickets at night, rain, a music-box note when they're happy) and a mute button.
- **A new colony opens with the three Wobblins asleep.** They pop awake one by one after you tap Wake them up.
- **Juice:** sparkles where seeds, gifts and blessings land; a big dust puff and a screen thump for boulders; happy Wobblins play tag now and then; at night by your clock, idle ones curl up to sleep by a hut.
- **Smoother:** no twitch when a new day starts; on a phone every tray tile now fits on screen (half the powers used to be out of reach) and the HUD is slimmer; small laptop windows and phones on their side get a compact HUD and one row of tiles; tray tiles have hover tips; Esc closes a panel; the recap also appears after a laptop slept with the game open.

## Under the hood

- A chaos test throws 8,700 random acts at 16 colonies: nothing crashes, no number goes out of range, and every save replays exactly.
- Ticks got faster with identical results, so a 90-day replay still runs in about 220 ms against the 250 ms target.
- A new syntax test parses every module, including the browser-only ones the other tests never load.
- CONTRACT.md and the README are up to date.

## Decisions you might want to change

- A boulder or lightning dropped right on a Wobblin can hurt it but never kills it. Lightning that only lands nearby can still hurt bystanders, as before.
- Goals and asks grant belief, which makes powers unlock faster. A busy player can reach the Age of Wonders in about 90 days.
- New colonies run three times faster for their first 12 watched days.
- The display font loads from Google Fonts, so it needs internet. Without it the page falls back to system fonts.

## Still waiting on you (from before)

- Deploy: Netlify or Cloudflare
- Confirm the waitlist URL
- Record the GIF
- Run the 3-person playtest
