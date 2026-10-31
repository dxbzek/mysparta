# Credits and asset licences

## Characters and weapons on the fight stage
**Liberated Pixel Cup (LPC) universal sprite set** — CC BY-SA 3.0 / GPL 3.0.
Composited at runtime by `apps/web/src/paperdoll.ts`; source layers live in
`apps/web/src/assets/lpc/`. Attribution is shown in the game's footer.

## Item, skill and creature icons
**All original.** Weapons (`cartoonArt.tsx`), the 30 skills (`skillArt.tsx`),
the 8 beasts (`beastArt.tsx`) and gear (`gearArt.tsx`) are hand-drawn SVG in
one idiom: flat colour, a single 2.2px `#241c14` outline, one highlight, no
shading, authored in a 32×32 box over a shared palette and parts vocabulary.

### Dungeon Crawl Stone Soup tiles — CC0, retained as a fallback
Source: <https://github.com/crawl/crawl>, `crawl-ref/source/rltiles/`.

63 tiles are still vendored under `apps/web/src/assets/icons/`:

| Group | Count | Taken from |
| --- | --- | --- |
| `weapon/` | 25 | `item/weapon/`, `item/weapon/ranged/`, `item/armour/shields/`, `item/armour/glove*` |
| `skill/` | 30 | `gui/spells/`, `gui/abilities/`, `gui/invocations/`, `gui/mutations/`, `gui/skills/` |
| `beast/` | 8 | `mon/animals/`, `UNUSED/monsters/fox.png` |

**No shipped content renders one any more** — every weapon, skill and beast in
the game is drawn. They stay wired so that a content id we have not drawn yet
is a picture rather than a blank plaque. Each file is renamed to the game's own
content id, so `weapon/kestros.png` is Crawl's
`item/weapon/ranged/sling1.png`. `src/tileArt.ts` resolves ids to URLs;
`.tile-art` in `styles.css` enforces `image-rendering: pixelated`.

CC0 requires no attribution. It is given anyway.

## Fonts
**Silkscreen** and **Karla** — SIL Open Font License 1.1, subset to latin and
inlined in `apps/web/src/fonts.css` so the build stays self-contained.

## Everything else
Arena backdrops, UI glyphs (`pixelIcons.tsx`), skill effects (`fightFx.tsx`)
and all sound are drawn or synthesised in-engine and are original to this
project.

## The one thing still borrowed
The fight stage's paper dolls are LPC pixel art while everything around them is
hand-drawn vector. That is the last split in the art direction, and it can only
close by replacing the fighter rig — a bought modular character pack, or a
drawn one with its own animation frames.
