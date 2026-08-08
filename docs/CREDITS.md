# Credits and asset licences

## Characters and weapons on the fight stage
**Liberated Pixel Cup (LPC) universal sprite set** — CC BY-SA 3.0 / GPL 3.0.
Composited at runtime by `apps/web/src/paperdoll.ts`; source layers live in
`apps/web/src/assets/lpc/`. Attribution is shown in the game's footer.

## Item, skill and creature icons
**Dungeon Crawl Stone Soup** tiles — **CC0** (public domain dedication).
Source: <https://github.com/crawl/crawl>, `crawl-ref/source/rltiles/`.

63 tiles are vendored under `apps/web/src/assets/icons/`:

| Group | Count | Taken from |
| --- | --- | --- |
| `weapon/` | 25 | `item/weapon/`, `item/weapon/ranged/`, `item/armour/shields/`, `item/armour/glove*` |
| `skill/` | 30 | `gui/spells/`, `gui/abilities/`, `gui/invocations/`, `gui/mutations/`, `gui/skills/` |
| `beast/` | 8 | `mon/animals/`, `UNUSED/monsters/fox.png` |

Each file is renamed to the game's own content id, so `weapon/kestros.png` is
Crawl's `item/weapon/ranged/sling1.png`. The mapping that produced them is
recorded in the commit that added the directory. Every tile is 32×32 (the fox
is 34×34), so the only crisp display sizes are whole multiples: 32, 64, 96.
`src/tileArt.ts` resolves ids to URLs; `.tile-art` in `styles.css` enforces
`image-rendering: pixelated`.

CC0 requires no attribution. It is given anyway.

## Fonts
**Silkscreen** and **Karla** — SIL Open Font License 1.1, subset to latin and
inlined in `apps/web/src/fonts.css` so the build stays self-contained.

## Everything else
Arena backdrops, UI glyphs (`pixelIcons.tsx`), gear and all sound are drawn or
synthesised in-engine and are original to this project.
