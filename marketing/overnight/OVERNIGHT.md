# Wobblins: what changed overnight (Oct 8)

Nothing here needs you to act. If you only have a minute, open the game and start a new colony.

**Try it:** run `node server.js` in `C:\Users\ignit\woblins`, then open:

- `http://localhost:8137/?debug=1&fresh=1` starts a brand-new colony (the new-player flow).
- `http://localhost:8137/?debug=1&devload=/_dev_save.json` loads a 300-day village with every power unlocked.

Sound plays after your first tap; the speaker button (top left) mutes it. Everything is committed in the local git repo, and all 13 test files pass.

## 1. Art

- **The valley is painted on a canvas.** It has alpine mountains with sunlit faces, snow and gullies, shaded clouds that change colour with the time of day, haze, and grass.
- **New art for every object.** Huts, the temple and the totem are now drawn at Wobblin scale, so a hut looks big enough to live in. Murals are painted slabs with handprints.
- **The world shows its history.** Dirt paths wear in wherever the Wobblins walk most, and grass grows back over paths they stop using. Chimney smoke appears once they know Hearth.
- **Wobblins look more individual.** Each has its own body build. Their brows show temperament (worried, determined, one brow raised, calm), elders carry a cane, and keepsakes are worn as charms.
- **New screens.** There's a title screen at dawn with three sleeping Wobblins, a wooden tray, a glass HUD and a rounded display font (Fredoka).

## 2. Deeper Wobblins

- **Seven stats out of 10,** including a new one, Caution. Every Wobblin starts different, and the stats drift with what happens to them.
- **Five skills that level up:** foraging, building, tinkering, exploring and storytelling.
- **Discoveries need the right temperament.** Huts and walls need a Wobblin who worries enough, fire needs a brave one, and the temple needs a devout one. Each Wobblin's card lists what it could work out if it had more of a trait.
- **Breeding works.** A baby takes after one parent or the other in each trait, with an occasional surprise, and a card shows what the baby inherited. To breed for a trait, set two single Wobblins down together near a hut.
- **Friends, rivals and squabbles** now form on their own.
- **Each Wobblin talks.** Its card shows one line in its own voice, drawn from its real memories, for example "A boulder squashed me flat. I'm fine. Mostly." This is a placeholder for the AI layer and follows the same grounding rule.
- **Tap a Wobblin's name to rename it.** There's also a Family panel that groups everyone by generation.

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
- **Drop powers on a Wobblin's head:**
  - stones: a bonk, which sometimes knocks an idea loose
  - a boulder: squashed flat. It can hurt, but never kills.
  - a seed: a flower crown, with a butterfly
  - lightning: frizzy fur, and sometimes a bright idea. The static shock spreads to anyone they bump into.
  - the daily gift: they catch it
- **Lightning on things:** it splits boulders into stones, blows cairns apart, makes a totem hum (the devout take it as a sign), stuns fish in the river, and cracks a frozen pond under anyone skating on it.
- **Cold snaps** freeze the pond. Add rain and you get snow, and the playful ones build snowmen.
- **New power, Shake the Valley** (unlocks at belief 26): berries rain down, cairns topple, old walls fall, the screen shakes, and timid Wobblins never forget it.
- **Room to play:** the valley has 35 open spots instead of 30. It also tidies itself: keepsakes get taken home and spare stones get used. Stones dropped on a small pile make the pile bigger.

## 4. A reason to play

- **Ages and 15 milestones** (the Goals button). Examples: tame fire, welcome a baby, three generations, a temple. Claiming one gives belief, and belief unlocks powers.
- **A first-time coach** gives four pointers: drag stones in, pick a Wobblin up, watch them think, claim a goal. Then it gets out of the way.
- **Big moments get their own card:** a discovery card with confetti and what it means, and a baby card showing who the baby takes after. Pop-ups queue one at a time.
- **Coming back after a while,** the recap now shows who each line is about and includes friendships and squabbles. In 85-97% of 8-hour absences there are now 3 or more changes, up from 63-93%.

## 5. Feel

- **Synthesized sound** for every action: pops, boings, splashes, zaps, rumbles, giggles and a eureka chime. There's quiet ambience too (birds by day, crickets at night, rain, a music-box note when they're happy), and a mute button.

## Also added later in the night

- **A painted icon for each of the 30 discoveries,** shown in the Discovery Book and on the eureka card.
- **The Chronicle has a "Their story" tab** that leaves out your own acts and routine level-ups, and every line shows a face or an icon.
- **A live ticker** in the bottom-left corner shows the day's most interesting happening while you watch.
- **Poke a Wobblin over and over** and it giggles, then gets cross, then runs off.
- **Portraits show flower crowns, frizz and charms.** The zap is easier to see from across the valley.
- **Smoother redraws:** the Wobblins no longer twitch when a new day starts.
- **Wobblins ask you for things,** from day one: berries when they're hungry, a friend when they're lonely, rain in a dry spell, stones to stack, flowers. A golden bubble shows what they want, and the top of the screen says how to help. Granting an ask makes them glow and gives belief. If you ignore it, they give up after a while.
- **A "How to play" card** (the ? button) lists every gesture and how belief works, for anyone you hand it to.
- **A quiet goodbye card** when a Wobblin dies: how it died, what it knew, who will miss it, and how many children carry on.
- **Juice:** sparkles where seeds, gifts and blessings land, and a big dust puff and a screen thump for boulders.
- **Their eyes follow your hand** around the valley. Happy Wobblins now keep their eyes open (big and shiny) instead of squinting, so you can see them look at you.
- **Hold a Wobblin still** for a couple of seconds and it dozes off in your hand. **Shake it back and forth** and it wobbles like jelly and stays rattled.
- **Pick things up:** press and drag stones, gifts, curios, sprouts or clay to set them down somewhere else.
- **Night falls on everything,** not only the sky. The Wobblins and huts dim with the light, and doorways and fires glow warm. Dusk turns everything rosy.
- **The temple looks Wobblin-built** now: stacked stones, carved posts, a leaf-thatch roof, prayer flags and a sun disc. It used to be white marble.
- **Happy Wobblins play tag** now and then: one dashes after another, who scampers off.
- **On phones** the HUD button row scrolls instead of getting cut off.
- **A chaos test** throws 8,700 random acts at 16 colonies. Nothing crashes, no number goes out of range, and every save replays exactly.

## Decisions you might want to change

- A boulder or lightning dropped right on a Wobblin can hurt it but never kills it. Lightning that only lands nearby can still hurt bystanders, as before.
- Goals grant belief, which makes powers unlock faster. A busy player can now reach the Age of Wonders in about 90 days.
- The display font loads from Google Fonts, so it needs internet. Without it the page falls back to system fonts.

## Still waiting on you (from before)

- Deploy: Netlify or Cloudflare
- Confirm the waitlist URL
- Record the GIF
- Run the 3-person playtest
