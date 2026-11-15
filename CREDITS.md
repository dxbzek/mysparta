# Credits

Everything in the game that was not made for it is listed here, one row per file, from the day it enters the repo.

Allowed licences for sounds and fonts: CC0, SIL OFL 1.1, Apache 2.0, OGA-BY, or CC BY with credit. Nothing marked NC, SA or GPL. Font licence files ship beside the fonts.

## Sounds

All sounds are mixed into two files by `tools/build-audio.mjs`: `apps/web/public/audio/sfx.mp3` (the core: the sound every cue family falls back to) and `sfx-content.mp3` (one sound set per weapon, shield and pet, or per material group). The map and the same credits are in `sfx.json`. Every source below was changed: cut to its onset, trimmed, faded, level-adjusted, some layered with a second file, and encoded to MP3. "Used for" names the sound sets that use the file (see `apps/web/src/audio/soundMap.ts`).

| File | Used for | Source URL | Author | Licence | Fetched |
|---|---|---|---|---|---|
| hit10.mp3.flac (37 hits/punches) | hit-fist, hit-knuckle | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| hit11.mp3.flac (37 hits/punches) | hit-fist | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| qubodupPunch05.flac (Punch) | hit-fist, hit-knuckle | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| bfh1_hit_10.ogg (75 CC0 breaking / falling / hit sfx) | hit-fist | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| knifeSlice2.ogg (RPG Audio (Kenney)) | hit-blade-small | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| blade_01.ogg (80 CC0 RPG SFX) | hit-blade-small | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| blade_03.ogg (80 CC0 RPG SFX) | hit-blade-small | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #11.wav (33 metal clang sounds from cast iron pans) | hit-pipe | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| qubodupPunch02.flac (Punch) | hit-pipe, block-arms, hit-blade-big, hit-wood, hit-heavy, hit-pan, hit-shovel, hit-light-metal, hit-brick, hit-paint, hit-hubcap, block-sheet | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| cast iron clangs - Marker #9.wav (33 metal clang sounds from cast iron pans) | hit-pipe | https://opengameart.org/content/33-metal-clang-sounds-cast-iron-pans | bart | CC0 1.0 | 2026-11-15 |
| qubodupPunch04.flac (Punch) | hit-pipe, block-arms, hit-blade-big, hit-wood, hit-pan, hit-shovel, hit-light-metal, hit-squeak, hit-plunger, hit-chain, hit-plastic, hit-rubber | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| metal_07.ogg (100 CC0 SFX) | hit-pipe | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cloth3.ogg (RPG Audio (Kenney)) | block-arms | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| cloth1.ogg (RPG Audio (Kenney)) | block-arms, hit-umbrella | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| swish_3.wav (Battle Sound Effects) | swish-medium | https://opengameart.org/content/battle-sound-effects | artisticdude | CC0 1.0 | 2026-11-15 |
| swish_4.wav (Battle Sound Effects) | swish-medium | https://opengameart.org/content/battle-sound-effects | artisticdude | CC0 1.0 | 2026-11-15 |
| swish-7.wav (Swishes Sound Pack) | swish-medium, dash | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| sword.5.ogg (20 Sword Sound Effects (Attacks and Clashes)) | throw, swish-whip | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 1.0 | 2026-11-15 |
| bfh1_metal_falling_02.ogg (75 CC0 breaking / falling / hit sfx) | drop-metal, block-frame | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_falling_02.ogg (100 CC0 metal and wood SFX) | drop-metal | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Dog Bark 1.wav (Dog sounds) | voice-dog | https://opengameart.org/content/dog-sounds | pauliuw | CC0 1.0 | 2026-11-15 |
| Dog Bark 3.wav (Dog sounds) | voice-dog | https://opengameart.org/content/dog-sounds | pauliuw | CC0 1.0 | 2026-11-15 |
| dog-growl.flac (Dog Snarl Grunt Grumble) | voice-dog | https://opengameart.org/content/dog-snarl-grunt-grumble | qubodup | CC0 1.0 | 2026-11-15 |
| footstep01.ogg (RPG Audio (Kenney)) | dash | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| swish-9.wav (Swishes Sound Pack) | dash | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| footstep08.ogg (RPG Audio (Kenney)) | dash | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 1.0 | 2026-11-15 |
| hit30.mp3.flac (37 hits/punches) | landing | https://opengameart.org/content/37-hitspunches | Independent.nu (submitted by qubodup) | CC0 1.0 | 2026-11-15 |
| qubodupPunch03.flac (Punch) | landing, hit-wood, hit-heavy, hit-squeak, hit-plunger, hit-chain, hit-brick, hit-plastic, hit-hubcap, hit-rubber | https://opengameart.org/content/punch | Iwan 'qubodup' Gabovitch | CC0 1.0 | 2026-11-15 |
| bfh1_hit_02.ogg (75 CC0 breaking / falling / hit sfx) | landing, hit-brick | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Gregor Quendel - Crowd Cheering Sounds - 03 - Strong cheering - I.mp3 (Free Crowd Cheering Sounds) | crowd | https://opengameart.org/content/free-crowd-cheering-sounds | Gregor Quendel | CC BY 4.0 | 2026-11-15 |
| crowd_shouting.ogg (Crowd Shouting/Speaking Ambience) | crowd | https://opengameart.org/content/crowd-shoutingspeaking-ambience | StarNinjas | CC0 1.0 | 2026-11-15 |
| jingles_HIT01.ogg (Music Jingles (Kenney)) | move | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
| jingles_HIT04.ogg (Music Jingles (Kenney)) | move | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
| jingles_HIT11.ogg (Music Jingles (Kenney)) | move | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
| jingles_HIT12.ogg (Music Jingles (Kenney)) | move | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 1.0 | 2026-11-15 |
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
| metal_sheet_05.ogg (100 CC0 metal and wood SFX) | hit-shovel | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_hit_03.ogg (100 CC0 metal and wood SFX) | hit-light-metal, block-frame | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_hit_04.ogg (100 CC0 metal and wood SFX) | hit-light-metal, block-parry | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| qubodupSqueakyRatAttack.flac (Squeaky Rat) | hit-squeak | https://opengameart.org/content/squeaky-rat | qubodup | CC0 1.0 | 2026-11-15 |
| qubodupSqueakyRatPain.flac (Squeaky Rat) | hit-squeak | https://opengameart.org/content/squeaky-rat | qubodup | CC0 1.0 | 2026-11-15 |
| pop5.ogg (Pop sounds (pop5)) | hit-plunger | https://opengameart.org/content/pop-sounds | cogitollc | CC0 1.0 | 2026-11-15 |
| pop7.ogg (Pop sounds (pop7)) | hit-plunger | https://opengameart.org/content/pop-sounds | cogitollc | CC0 1.0 | 2026-11-15 |
| wood_hit_06.ogg (100 CC0 metal and wood SFX) | hit-umbrella, hit-darts | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| chain_01.ogg (80 CC0 RPG SFX) | hit-chain | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| chain_02.ogg (80 CC0 RPG SFX) | hit-chain | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_hit_05.ogg (100 CC0 metal and wood SFX) | hit-darts | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| slam_04.ogg (100 CC0 SFX) | hit-brick | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_slam_01.ogg (100 CC0 metal and wood SFX) | hit-paint, block-sheet, drop-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| plop_02.ogg (100 CC0 SFX) | hit-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| plop_01.ogg (100 CC0 SFX) | hit-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| bung_01.mp3 (Boings) | hit-ball | https://opengameart.org/content/boings | EZduzziteh | CC0 1.0 | 2026-11-15 |
| boing.flac (BOING!) | hit-ball | https://opengameart.org/content/boing | Aeva | CC0 1.0 | 2026-11-15 |
| metal_sheet_01.ogg (100 CC0 metal and wood SFX) | hit-hubcap, block-tin | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_04.ogg (100 CC0 metal and wood SFX) | hit-hubcap, block-tin | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| thwack-02.wav (Thwack Sounds) | hit-rubber | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| thwack-05.wav (Thwack Sounds) | hit-rubber, drop-soft | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| bfh1_metal_hit_02.ogg (75 CC0 breaking / falling / hit sfx) | block-parry | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_sheet_06.ogg (100 CC0 metal and wood SFX) | block-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| metal_02.ogg (100 CC0 SFX) | block-tin | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| hit_03.ogg (100 CC0 SFX) | block-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| hit_04.ogg (100 CC0 SFX) | block-plastic | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_slam_01.ogg (100 CC0 metal and wood SFX) | block-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_slam_04.ogg (100 CC0 metal and wood SFX) | block-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_03.ogg (80 CC0 RPG SFX) | block-wood | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| swish-11.wav (Swishes Sound Pack) | swish-light | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| swish-13.wav (Swishes Sound Pack) | swish-light | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| sword.6.ogg (20 Sword Sound Effects (Attacks and Clashes)) | swish-light | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 1.0 | 2026-11-15 |
| swish-3.wav (Swishes Sound Pack) | swish-heavy | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| metal_swing1.wav (Metal Interactions) | swish-heavy | https://opengameart.org/content/metal-interactions | qubodup | CC0 1.0 | 2026-11-15 |
| swish-8.wav (Swishes Sound Pack) | swish-heavy | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 1.0 | 2026-11-15 |
| chain_03.ogg (80 CC0 RPG SFX) | swish-whip | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| car_spinning.wav (Spin) | throw-spin | https://opengameart.org/content/spin | Rocha57 | CC0 1.0 | 2026-11-15 |
| bfh1_wood_falling_02.ogg (75 CC0 breaking / falling / hit sfx) | drop-wood | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| wood_falling_01.ogg (100 CC0 metal and wood SFX) | drop-wood | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| thwack-07.wav (Thwack Sounds) | drop-soft | https://opengameart.org/content/thwack-sounds | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| metal_sheet_03.ogg (100 CC0 metal and wood SFX) | drop-sheet | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| crow_caw.wav (Crow caw) | voice-crow | https://opengameart.org/content/crow-caw | zeroisnotnull | CC0 1.0 | 2026-11-15 |
| crow.ogg (Crow) | voice-crow | https://opengameart.org/content/crow | fvcalderan | CC0 1.0 | 2026-11-15 |
| bicycle-horn-1.wav (Bicycle Horn) | voice-goose | https://opengameart.org/content/bicycle-horn | Jordan Irwin (AntumDeluge) | CC0 1.0 | 2026-11-15 |
| cute_07.ogg (80 CC0 creature SFX) | voice-raccoon | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| cute_08.ogg (80 CC0 creature SFX) | voice-raccoon | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| pig_hit1.mp3 (Pig SFX Pack (pig_hit1)) | voice-boar | https://opengameart.org/content/pig-sfx-pack | Vinrax | CC BY 3.0 | 2026-11-15 |
| pig_hit2.mp3 (Pig SFX Pack (pig_hit2)) | voice-boar | https://opengameart.org/content/pig-sfx-pack | Vinrax | CC BY 3.0 | 2026-11-15 |
| grunt_02.ogg (80 CC0 creature SFX) | voice-boar | https://opengameart.org/content/80-cc0-creature-sfx | rubberduck | CC0 1.0 | 2026-11-15 |
| Cat 7.wav (Cat SFX (Cat 7)) | voice-cat | https://opengameart.org/content/cat-sfx | Dan Knoflicek (Macro) | CC BY 3.0 | 2026-11-15 |
| Cat 8.wav (Cat SFX (Cat 8)) | voice-cat | https://opengameart.org/content/cat-sfx | Dan Knoflicek (Macro) | CC BY 3.0 | 2026-11-15 |

## Fonts

No font is in the repo yet.

| File | Used for | Source URL | Author | Licence | Fetched |
|---|---|---|---|---|---|

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
