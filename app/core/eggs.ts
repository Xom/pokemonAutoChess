import type Player from "../models/colyseus-models/player"
import type { Egg } from "../models/colyseus-models/pokemon"
import PokemonFactory from "../models/pokemon-factory"
import { getPokemonData } from "../models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "../models/precomputed/precomputed-rarity"
import { PokemonActionState } from "../types/enum/Game"
import { Pkm, PkmInteger, PkmByInteger } from "../types/enum/Pokemon"
import { getFirstAvailablePositionInBench } from "../utils/board"
import { PRNG_P_OFFSET_EGG } from "../utils/random"
import { getHatchTime } from "./evolution-logic/hatch-time"
import { randomNeedle } from "shuffle-duplication"

export function createRandomEgg(player: Player, shiny: boolean): Egg {
  const hatchList = PRECOMPUTED_POKEMONS_PER_RARITY.HATCH.filter(
    (p) => getPokemonData(p).stars === 1
  )
  const egg = PokemonFactory.createPokemonFromName(Pkm.EGG, { shiny }) as Egg
  egg.action = PokemonActionState.SLEEP
  egg.stacksRequired = getHatchTime(egg, player)

  const remainingEggs = hatchList.filter(
    (p) => !player.randomEggsGiven.includes(p)
  )
  egg.evolution = PkmByInteger[parseInt(
    randomNeedle(player.rngState, Object.fromEntries(
      (remainingEggs.length > 0 ? remainingEggs : hatchList).map(pkm => [PkmInteger[pkm] + PRNG_P_OFFSET_EGG, 1])
    ))!
  ) - PRNG_P_OFFSET_EGG]
  player.randomEggsGiven.push(egg.evolution)

  return egg as Egg
}

export function giveRandomEgg(player: Player, shiny = false): Egg | undefined {
  const x = getFirstAvailablePositionInBench(player.board)
  if (x !== null) {
    const egg = createRandomEgg(player, shiny)
    egg.positionX = x
    egg.positionY = 0
    player.board.set(egg.id, egg)
    player.pokemonsPlayed.add(Pkm.EGG)
    return egg
  }
}
