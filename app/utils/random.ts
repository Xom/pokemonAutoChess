import type { PCGState, RandomFn } from "pcg"
import { randomInt } from "pcg"
import type { RandomResult } from "shuffle-duplication"
import { TWO32, INV_TWO32, uint64, max } from "./number"

export function chance(
  probability: number,
  pokemon?: { luck: number },
  cap = 1
): boolean {
  if (probability === 0) return false // prevent return true if 100% luck and 0 probability
  return (
    Math.random() <
    max(cap)(Math.pow(probability, 1 - (pokemon?.luck ?? 0) / 100))
  )
}

export function randomWeighted<T extends string>(
  weights: { [item in T]?: number },
  totalWeight?: number,
  ap: number = 0,
  apScaling: number = 1,
  luck: number = 0
): T | null {
  if (totalWeight === undefined) {
    totalWeight = (Object.values(weights) as number[]).reduce(
      (sum: number, weight: number) => sum + weight,
      0
    )
  }
  let random =
    Math.random() *
    totalWeight *
    (1 + ap * (apScaling / 100)) *
    (1 + luck / 100)
  for (const [item, weight] of Object.entries(weights) as [T, number][]) {
    if ((random -= weight) < 0) return item
  }
  return null
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

export function pickRandomIn<T>(
  list: T[] | readonly T[] | Record<string, T>
): T {
  if (!Array.isArray(list)) return pickRandomIn(Object.values(list))
  return list[Math.floor(Math.random() * list.length)]
}

export function pickNRandomIn<T>(
  array: T[] | readonly T[],
  number: number
): T[] {
  const selection: T[] = [],
    options = [...array]
  shuffleArray(options)
  while (selection.length < number && options.length > 0) {
    selection.push(options.pop()!)
  }
  return selection
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
export function shuffleArray<T extends Array<unknown>>(array: T): T {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

export function simpleHashSeededCoinFlip(seed: string) {
  // Simple hash function to turn a string into a boolean coin flip
  const hash = Array.from(seed).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  )
  return hash % 2 === 0
}

function randomUint32(): number {
  return randomBetween(0, TWO32)
}

export function randomUint64(): bigint {
  return uint64(randomUint32(), randomUint32())
}

const pcgRandomUint32 : RandomFn<number> = randomInt(0, TWO32)

export const pcgRandomUint64 : RandomFn<bigint> = (pcgState: PCGState) => {
  const [lo, s1] = pcgRandomUint32(pcgState)
  const [hi, s2] = pcgRandomUint32(s1)
  return [uint64(hi, lo), s2]
}

export const pcgRandomFloat : RandomFn<number> = (pcgState: PCGState) => {
  const [value, nextState] = randomInt(0, TWO32, pcgState)
  return [value * INV_TWO32, nextState]
}

export function pcgRandomWeighted<T extends string>(
  pcgState: PCGState,
  weights: { [item in T]?: number },
  totalWeight?: number,
  ap: number = 0,
  apScaling: number = 1,
  luck: number = 0
): RandomResult<T | null> {
  if (totalWeight === undefined) {
    totalWeight = (Object.values(weights) as number[]).reduce(
      (sum: number, weight: number) => sum + weight,
      0
    )
  }
  const [r, nextState] = pcgRandomFloat(pcgState)
  let random =
    r *
    totalWeight *
    (1 + ap * (apScaling / 100)) *
    (1 + luck / 100)
  for (const [item, weight] of Object.entries(weights) as [T, number][]) {
    if ((random -= weight) < 0) return [item, nextState]
  }
  return [null, nextState]
}

// Xom: These ID offsets deserve to live in their own file, but I'm too lazy to move them just now

export const PRNG_SUBOFFSET = 1_0000_0000
export const PRNG_N_DEFAULT_PLAYER_SEED = 1
export const PRNG_N_ENCOUNTER_MAGNEZONE_OUTLAW_STAGE = 2
export const STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER = "3"
export const STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE = "4"
export const PRNG_N_PORTAL_SYMBOL_SEED = 5
export const PRNG_N_PVE_SHINY = 6
export const PRNG_N_OFFSET_TOWN_ENCOUNTER = 0 // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
export const PRNG_N_OFFSET_CAROUSEL_SYNERGY = 2_0000_0000_0000
export const PRNG_N_OFFSET_CAROUSEL_ITEM = 3_0000_0000_0000
export const PRNG_N_OFFSET_CAROUSEL_MAP = 4_0000_0000_0000
export const PRNG_P_CAROUSEL_POS = 1
export const PRNG_P_STARTER_EEVEE = 2
export const PRNG_P_OFFSET_UNIQUE_PROPOSITION_KECLEON = 3
export const PRNG_P_OFFSET_UNIQUE_PROPOSITION_ARCEUS = 4
export const PRNG_P_OFFSET_SHOP_RARITY = 5 // I have a more clever rarity implementation I prefer, but for the proof of concept, I won't bother
export const PRNG_P_OFFSET_DITTO = 6
export const PRNG_P_OFFSET_FALINKS = 7
export const PRNG_P_OFFSET_FISH_RARITY = 8
export const PRNG_P_OFFSET_MAGNET_PULL_RARITY = 9
export const PRNG_P_OFFSET_BURIED_SHUFFLE = 1_0000_0000
export const PRNG_P_OFFSET_FLOWER_POT = 2_0000_0000
// export const PRNG_P_OFFSET_SHOP = 0 // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
export const PRNG_P_OFFSET_CAROUSEL_SYNERGY = 2_0000_0000_0000
export const PRNG_P_OFFSET_EGG = 2_0000_0000_0000 // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
export const PRNG_P_OFFSET_ITEM_PICK = 4_0000_0000_0000
export const PRNG_P_OFFSET_ITEM_FREE = 5_0000_0000_0000
export const PRNG_P_OFFSET_BERRY_TREE = 6_0000_0000_0000 // also used for Charcadet armor, thanks to lack of overlap
export const PRNG_P_OFFSET_UNIQUE_PROPOSITION_SYNERGIES = 7_0000_0000_0000 // "unique proposition" also refers to starter pokemon
export const PRNG_P_OFFSET_UNIQUE_PROPOSITION = 7_0000_0000_0000 // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
export const PRNG_P_OFFSET_UNIQUE_PROPOSITION_VARIANT = 8_0000_0000_0000 // Ideally, this wouldn't be a separate call, but for the proof-of-concept, I won't strain myself // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
export const PRNG_P_OFFSET_ADD = 9_0000_0000_0000 // PkmInteger are in [1_0000_0000_0000, 2_0000_0000_0000)
