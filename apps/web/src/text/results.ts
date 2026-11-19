/**
 * One-line bout results (brief 3.11), our own. `me` is the player's scrapper, `them` the rival.
 * Chosen by the bout's `lineId`, so a replay and the history show the same line. Lines never
 * mention sim units.
 */
export const WIN_LINES: readonly string[] = [
  "{me} folded {them} like a deckchair.",
  "{me} sent {them} home with a story nobody will believe.",
  "{them} blinked. {me} did not.",
  "{me} mopped the floor with {them}, then tidied up.",
  "{them} came in loud. {me} sent them out quiet.",
  "{me} made it look like a warm-up.",
  "{them} wants a rematch. {me} wants a sandwich.",
  "{me} wins, and the crowd pretends they saw it coming.",
  "{them} took a nap halfway through. {me} allowed it.",
  "{me} put {them} on the floor and left a note.",
  "{them} brought a plan. {me} brought a better one.",
  "The Yard has a new favourite, and it is {me}.",
  "{me} gave {them} a lesson, free of charge.",
  "{me} dropped {them} like a folding table.",
  "{me} won ugly, and ugly still counts.",
  "{them} asked for it, politely. {me} delivered.",
  "{me} rang the bell on {them}.",
  "{them} is still looking for the number plate of {me}.",
  "{me} flattened {them} and did not spill a drop.",
  "{them} kept walking into {me}. Bold choice.",
  "{me} turned {them} into a cautionary tale.",
];

export const LOSS_LINES: readonly string[] = [
  "{me} went looking for a fight and found a better one.",
  "{them} sent {me} to the floor for a lie-down.",
  "{me} had a plan. {them} had a better one.",
  "{me} lost, but looked great doing it. Mostly.",
  "{them} folded {me} into a neat little square.",
  "{me} will be feeling that one tomorrow.",
  "{them} used {me} as a practice dummy.",
  "{me} checked the floor for loose change. Twice.",
  "{them} won, and {me} would like to see the replay.",
  "{me} learned something tonight, mostly about ducking.",
  "{them} turned the lights out on {me}.",
  "{me} brought heart. {them} brought more.",
  "{them} rang {me}'s bell and kept the change.",
  "{me} lost the bout and most of the argument.",
  "{them} was having a good night, and {me} was part of it.",
  "{me} will tell everyone it was the shoes.",
  "{them} flattened {me} like a cardboard box.",
  "{me} lasted longer than the crowd expected. Not by much.",
  "{them} sent {me} back to the Locker to think.",
  "{me} needs a minute. Maybe two.",
  "{them} took the bout and {me}'s dignity with it.",
];

export function resultLine(lineId: number, won: boolean, me: string, them: string): string {
  const list = won ? WIN_LINES : LOSS_LINES;
  const i = ((Math.floor(lineId) % list.length) + list.length) % list.length;
  return list[i]!.replace(/\{me\}/g, me).replace(/\{them\}/g, them);
}
