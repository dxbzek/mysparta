# Credits

Everything in the game that was not made for it is listed here, one row per file, from the day it enters the repo.

Allowed licences for sounds and fonts: CC0, SIL OFL 1.1, Apache 2.0, OGA-BY, CC BY with credit. Nothing marked NC, SA or GPL. Font licence files ship beside the fonts.

Envato Elements audio (the owner's licence) never enters this repo, not even as a cut clip: the repo is public, and the Envato Elements licence forbids redistributing an item "as-is or with superficial modifications" and letting anyone "extract an Item and use it separately from the End Product" (clause 12 b and e, https://help.elements.envato.com/hc/en-us/articles/360000628966, read 19 Nov 2026). Licensed files live in a private folder outside the repo; `pnpm build` (through `tools/build-audio.mjs --overlay`) mixes them into the built site only, and the built `sfx.json` and `music.json` credit them. Every file in this repo is CC0 or CC BY, so a clone builds and plays without the private folder.

## Sounds

All sounds are mixed into two files by `tools/build-audio.mjs`: `apps/web/public/audio/sfx.mp3` (the core: the sound every cue family falls back to, every pet's voice and every Move's own sounds) and `sfx-content.mp3` (one sound set per weapon, shield and pet, or per material group). The map and the same credits are in `sfx.json`. Every source below was changed: cut to its onset, trimmed, faded, level-adjusted, some layered with a second file, and encoded to MP3. "Used for" names the sound sets that use the file (see `apps/web/src/audio/soundMap.ts`).

Three sounds have no source file: the air horn, the referee's pea whistle and the goose's honk are synthesised by `tools/build-audio.mjs` (its `SYNTH` recipes), made for this game and given to the public domain (CC0). A recording can replace any of them by changing its set in the build script, or in the built site only through the private folder.

Moved out on 19 Nov 2026: the two Envato Elements clips (Goose Honks by HollywoodEdge, Raccoon Snorts and Growls by prosoundfx) were in `sfx.mp3` until then. They now come only from the private folder; the repo's goose is the synthesised honk and its raccoon two CC0 creature sounds. Older commits of `sfx.mp3` still hold the two clips.

## Music

All music is in `apps/web/public/audio/music/` with its loop points in `music.json`, written by `tools/build-audio.mjs` from the recipes in `tools/audio-music.mjs`: made for this game and given to the public domain (CC0). The owner's licensed tracks replace any slot in the built site only (see above).

| File | Used for | Source | Author | Licence | Made |
|---|---|---|---|---|---|
| menu.mp3 | the menus and the Locker (loop) | tools/audio-music.mjs | Rank Zero | CC0 1.0 | 2026-11-19 |
| fight-calm.mp3, fight-intense.mp3 | the fight (two layers of one loop, crossfaded by HP) | tools/audio-music.mjs | Rank Zero | CC0 1.0 | 2026-11-19 |
| ko.mp3, win.mp3, lose.mp3, level-up.mp3 | stings | tools/audio-music.mjs | Rank Zero | CC0 1.0 | 2026-11-19 |

## Sound table

| File | Used for | Source URL | Author | Licence | Fetched |
|---|---|---|---|---|---|
| hit10.mp3.flac (37 hits/punches) | hit-fist, hit-knuckle | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| hit11.mp3.flac (37 hits/punches) | hit-fist | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| qubodupPunch05.flac (Punch) | hit-fist, hit-knuckle | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| bfh1_hit_10.ogg (75 CC0 breaking / falling / hit sfx) | hit-fist | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| knifeSlice2.ogg (RPG Audio (Kenney)) | hit-blade-small, hit-stab, hit-claw | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| qubodupPunch04.flac (Punch) | hit-blade-small, hit-pipe, block-arms, move-grab, move-squeeze, hit-blade-big, hit-wood, hit-pan, hit-shovel, hit-chair, hit-stab, hit-light-metal, hit-squeak, hit-plunger, hit-chain, hit-plastic, hit-ball, hit-rubber, hit-bite, hit-peck, hit-claw | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| blade_01.ogg (80 CC0 RPG SFX) | hit-blade-small, hit-stab | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| qubodupPunch02.flac (Punch) | hit-blade-small, hit-pipe, block-arms, hit-blade-big, hit-wood, hit-heavy, hit-pan, hit-shovel, hit-chair, hit-stab, hit-light-metal, hit-brick, hit-paint, hit-hubcap, hit-claw, hit-gore, block-sheet | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| blade_03.ogg (80 CC0 RPG SFX) | hit-blade-small, hit-claw | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #11.wav (33 metal clang sounds from cast iron pans) | hit-pipe | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #9.wav (33 metal clang sounds from cast iron pans) | hit-pipe | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| metal_07.ogg (100 CC0 SFX) | hit-pipe | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cloth3.ogg (RPG Audio (Kenney)) | block-arms, move-heave, move-grab-grunt | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| cloth1.ogg (RPG Audio (Kenney)) | block-arms, move-tarp-land, move-squeeze, hit-umbrella | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| swish_3.wav (Battle Sound Effects) | swish-medium, throw, swish-heavy | https://opengameart.org/content/battle-sound-effects | artisticdude | CC0 1.0 | 2026-11-15 |
| swish_4.wav (Battle Sound Effects) | swish-medium, throw, swish-light | https://opengameart.org/content/battle-sound-effects | artisticdude | CC0 1.0 | 2026-11-15 |
| swish-7.wav (Swishes Sound Pack) | swish-medium, throw, dash | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| swish_2.wav (Battle Sound Effects) | swish-medium, swish-light | https://opengameart.org/content/battle-sound-effects | artisticdude | CC0 1.0 | 2026-11-15 |
| bfh1_metal_falling_02.ogg (75 CC0 breaking / falling / hit sfx) | drop-metal, block-frame | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_falling_02.ogg (100 CC0 metal and wood SFX) | drop-metal | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Dog Bark 1.wav (Dog sounds) | voice-dog | https://opengameart.org/content/dog-sounds | pauliuw | CC0 1.0 | 2026-11-15 |
| Dog Bark 3.wav (Dog sounds) | voice-dog | https://opengameart.org/content/dog-sounds | pauliuw | CC0 1.0 | 2026-11-15 |
| dog-growl.flac (Dog Snarl Grunt Grumble) | voice-dog | https://opengameart.org/content/dog-snarl-grunt-grumble | qubodup | CC0 1.0 | 2026-11-15 |
| crow_caw.wav (Crow caw) | voice-crow | https://opengameart.org/content/crow-caw | zeroisnotnull | CC0 1.0 | 2026-11-15 |
| crow.ogg (Crow) | voice-crow | https://opengameart.org/content/crow | fvcalderan | CC0 1.0 | 2026-11-15 |
| goose-honk (Synthesised in tools/build-audio.mjs) | voice-goose | tools/build-audio.mjs | Rank Zero | CC0 1.0 | 2026-11-16 |
| goose-honk-2 (Synthesised in tools/build-audio.mjs) | voice-goose | tools/build-audio.mjs | Rank Zero | CC0 1.0 | 2026-11-16 |
| nose.ogg (80 CC0 creature SFX) | voice-raccoon, move-snort | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| grunt_04.ogg (80 CC0 creature SFX) | voice-raccoon | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| pig_hit1.mp3 (Pig SFX Pack (pig_hit1)) | voice-boar, hit-gore | https://opengameart.org/content/pig-sfx-pack | Vinrax | CC BY 3.0 | 2026-11-15 |
| pig_hit2.mp3 (Pig SFX Pack (pig_hit2)) | voice-boar | https://opengameart.org/content/pig-sfx-pack | Vinrax | CC BY 3.0 | 2026-11-15 |
| grunt_02.ogg (80 CC0 creature SFX) | voice-boar, hit-gore | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Cat 7.wav (Cat SFX (Cat 7)) | voice-cat | https://opengameart.org/content/cat-sfx | Dan Knoflicek (Macro) | CC BY 3.0 | 2026-11-15 |
| Cat 8.wav (Cat SFX (Cat 8)) | voice-cat | https://opengameart.org/content/cat-sfx | Dan Knoflicek (Macro) | CC BY 3.0 | 2026-11-15 |
| footstep01.ogg (RPG Audio (Kenney)) | dash | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| swish-9.wav (Swishes Sound Pack) | dash | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| footstep08.ogg (RPG Audio (Kenney)) | dash | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| hit30.mp3.flac (37 hits/punches) | landing, hit-accent | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| qubodupPunch03.flac (Punch) | landing, move-slam, hit-wood, hit-heavy, hit-squeak, hit-plunger, hit-chain, hit-brick, hit-plastic, hit-ball, hit-hubcap, hit-rubber, hit-bite, hit-peck, hit-gore, drop-stone | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| bfh1_hit_02.ogg (75 CC0 breaking / falling / hit sfx) | landing, hit-brick, hit-gore, drop-stone | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Gregor Quendel - Crowd Cheering Sounds - 03 - Strong cheering - I.mp3 (Free Crowd Cheering Sounds) | crowd | https://opengameart.org/content/free-crowd-cheering-sounds | Gregor Quendel | CC BY 4.0 | 2026-11-15 |
| crowd_shouting.ogg (Crowd Shouting/Speaking Ambience) | crowd | https://opengameart.org/content/crowd-shoutingspeaking-ambience | StarNinjas | CC0 1.0 | 2026-11-15 |
| cloth2.ogg (RPG Audio (Kenney)) | move, move-grab, move-sand | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| spell_02.ogg (80 CC0 RPG SFX) | move-charge, move-haymaker-hit | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| spell_fire_06.ogg (80 CC0 RPG SFX) | move-charge, move-fuse | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| explosion.ogg (100 CC0 SFX) | move-haymaker-hit, move-crackers | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metalLatch.ogg (RPG Audio (Kenney)) | move-can-open | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| noise_01.ogg (100 CC0 SFX) | move-can-open, move-sand | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| burble_02.ogg (80 CC0 creature SFX) | move-gulp | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cloth4.ogg (RPG Audio (Kenney)) | move-tarp-shake, move-sand-scoop | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| clothBelt2.ogg (RPG Audio (Kenney)) | move-tarp-shake | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| dropLeather.ogg (RPG Audio (Kenney)) | move-tarp-land | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| thwack-05.wav (Thwack Sounds) | move-tarp-land, hit-rubber, drop-soft | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| pea-whistle (Synthesised in tools/build-audio.mjs) | move-whistle | tools/build-audio.mjs | Rank Zero | CC0 1.0 | 2026-11-16 |
| shot_01.ogg (100 CC0 SFX) | move-crackers | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| pop5.ogg (Pop sounds (pop5)) | move-crackers, hit-plunger | https://opengameart.org/content/pop-sounds | cogitollc | CC0 1.0 | 2026-11-15 |
| shot_02.ogg (100 CC0 SFX) | move-crackers | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| pop7.ogg (Pop sounds (pop7)) | move-crackers, hit-plunger | https://opengameart.org/content/pop-sounds | cogitollc | CC0 1.0 | 2026-11-15 |
| handleSmallLeather.ogg (RPG Audio (Kenney)) | move-grab | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| air-horn (Synthesised in tools/build-audio.mjs) | move-air-horn | tools/build-audio.mjs | Rank Zero | CC0 1.0 | 2026-11-16 |
| grunt_03.ogg (80 CC0 creature SFX) | move-heave | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| slam_02.ogg (100 CC0 SFX) | move-slam, hit-accent | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| stones_04.ogg (80 CC0 RPG SFX) | move-sand-scoop, move-sand | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| misc_09.ogg (80 CC0 creature SFX) | move-shout | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| breath.ogg (80 CC0 creature SFX) | move-breath | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| hurt_05.ogg (80 CC0 creature SFX) | move-grab-grunt | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| grunt_01.ogg (80 CC0 creature SFX) | move-squeeze | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| WinBrass.wav (Win Jingle) | win | https://opengameart.org/content/win-jingle | Fupi | CC0 1.0 | 2026-11-15 |
| jingles_SAX01.ogg (Music Jingles (Kenney)) | loss | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
| click_001.ogg (Interface Sounds (Kenney)) | ui-tap | https://opengameart.org/content/interface-sounds | Kenney | CC0 1.0 | 2026-11-15 |
| select_001.ogg (Interface Sounds (Kenney)) | ui-tap | https://opengameart.org/content/interface-sounds | Kenney | CC0 1.0 | 2026-11-15 |
| bookFlip3.ogg (RPG Audio (Kenney)) | card-flip | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| jingles_STEEL04.ogg (Music Jingles (Kenney)) | level-up | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
| metal_hit_01.ogg (100 CC0 metal and wood SFX) | hit-knuckle, hit-darts | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_hit_05.ogg (100 CC0 metal and wood SFX) | hit-knuckle, hit-darts | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| chop.ogg (RPG Audio (Kenney)) | hit-blade-big | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| blade_02.ogg (80 CC0 RPG SFX) | hit-blade-big | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_hit_09.ogg (100 CC0 metal and wood SFX) | hit-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_hammer_02.ogg (100 CC0 metal and wood SFX) | hit-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_hit_08.ogg (100 CC0 metal and wood SFX) | hit-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| gong_02.ogg (100 CC0 SFX) | hit-heavy | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_08.ogg (100 CC0 SFX) | hit-heavy | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #18.wav (33 metal clang sounds from cast iron pans) | hit-pan | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #10.wav (33 metal clang sounds from cast iron pans) | hit-pan | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| metal_sheet_02.ogg (100 CC0 metal and wood SFX) | hit-shovel, block-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_05.ogg (100 CC0 metal and wood SFX) | hit-shovel, hit-chair | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_06.ogg (100 CC0 metal and wood SFX) | hit-chair, block-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_slam_01.ogg (100 CC0 metal and wood SFX) | hit-chair, hit-paint, block-sheet, drop-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_hit_03.ogg (100 CC0 metal and wood SFX) | hit-light-metal, block-frame | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_hit_04.ogg (100 CC0 metal and wood SFX) | hit-light-metal, block-parry | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| qubodupSqueakyRatAttack.flac (Squeaky Rat) | hit-squeak | https://opengameart.org/content/squeaky-rat | qubodup | CC0 1.0 | 2026-11-15 |
| qubodupSqueakyRatPain.flac (Squeaky Rat) | hit-squeak | https://opengameart.org/content/squeaky-rat | qubodup | CC0 1.0 | 2026-11-15 |
| wood_hit_06.ogg (100 CC0 metal and wood SFX) | hit-umbrella, hit-darts, hit-peck | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| chain_01.ogg (80 CC0 RPG SFX) | hit-chain | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| chain_02.ogg (80 CC0 RPG SFX) | hit-chain | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_hit_05.ogg (100 CC0 metal and wood SFX) | hit-darts, hit-peck | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| slam_04.ogg (100 CC0 SFX) | hit-brick | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| plop_02.ogg (100 CC0 SFX) | hit-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| plop_01.ogg (100 CC0 SFX) | hit-plastic, hit-ball | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| thwack-07.wav (Thwack Sounds) | hit-ball, drop-soft | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| thwack-02.wav (Thwack Sounds) | hit-ball, hit-rubber | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| metal_sheet_01.ogg (100 CC0 metal and wood SFX) | hit-hubcap, block-tin | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_04.ogg (100 CC0 metal and wood SFX) | hit-hubcap, block-tin | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| eat_02.ogg (80 CC0 creature SFX) | hit-bite | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| eat_03.ogg (80 CC0 creature SFX) | hit-bite | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| swish-11.wav (Swishes Sound Pack) | hit-claw | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| swish-13.wav (Swishes Sound Pack) | hit-claw | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| bfh1_metal_hit_02.ogg (75 CC0 breaking / falling / hit sfx) | block-parry | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_02.ogg (100 CC0 SFX) | block-tin | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| hit_03.ogg (100 CC0 SFX) | block-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| hit_04.ogg (100 CC0 SFX) | block-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_slam_01.ogg (100 CC0 metal and wood SFX) | block-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_slam_04.ogg (100 CC0 metal and wood SFX) | block-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_03.ogg (80 CC0 RPG SFX) | block-wood | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| sword.6.ogg (20 Sword Sound Effects (Attacks and Clashes)) | swish-light | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 1.0 | 2026-11-15 |
| swish-10.wav (Swishes Sound Pack) | swish-light | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| swish-3.wav (Swishes Sound Pack) | swish-heavy | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| metal_swing1.wav (Metal Interactions) | swish-heavy | https://opengameart.org/content/metal-interactions | qubodup | CC0 1.0 | 2026-11-15 |
| swish-8.wav (Swishes Sound Pack) | swish-heavy | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| sword.5.ogg (20 Sword Sound Effects (Attacks and Clashes)) | swish-whip | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 1.0 | 2026-11-15 |
| chain_03.ogg (80 CC0 RPG SFX) | swish-whip | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| car_spinning.wav (Spin) | throw-spin | https://opengameart.org/content/spin | Rocha57 | CC0 1.0 | 2026-11-15 |
| bfh1_wood_falling_02.ogg (75 CC0 breaking / falling / hit sfx) | drop-wood | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_falling_01.ogg (100 CC0 metal and wood SFX) | drop-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| bfh1_rock_hit_01.ogg (75 CC0 breaking / falling / hit sfx) | drop-stone | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| item_stone_01.ogg (80 CC0 RPG SFX) | drop-stone | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_03.ogg (100 CC0 metal and wood SFX) | drop-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |

## Fonts

Both fonts are subset by `tools/subset-fonts.mjs` from the Google Fonts repository and ship with their licence files beside them in `apps/web/public/fonts/`.

| File | Used for | Source URL | Author | Licence | Fetched |
|---|---|---|---|---|---|
| display.woff2 (Big Shoulders Display, subset, weight 900) | headings, stickers, stage text | https://github.com/google/fonts/tree/main/ofl/bigshouldersdisplay | The Big Shoulders Project Authors | SIL OFL 1.1 (OFL-BigShouldersDisplay.txt) | 2026-11-14 |
| body.woff2 (Inter, subset, weights 400-700) | body text | https://github.com/google/fonts/tree/main/ofl/inter | The Inter Project Authors | SIL OFL 1.1 (OFL-Inter.txt) | 2026-11-14 |

## Art

No art file is in the repo. All art is flat vector data written in code for this game. No image was traced, borrowed or generated.

## Code that ships in the built site

| Package | Licence |
|---|---|
| react | MIT |
| react-dom | MIT |

## Tools used to build and test (not shipped)

Licences read from each package's own licence file or manifest on 14 November 2026.

| Package | Licence |
|---|---|
| typescript | Apache-2.0 |
| vite, @vitejs/plugin-react | MIT |
| vitest | MIT |
| tsx | MIT |
| @napi-rs/canvas | MIT |
| fake-indexeddb | Apache-2.0 |
| subset-font | BSD-3-Clause |
| playwright-core | Apache-2.0 |
| @types/react, @types/react-dom | MIT |
