import type { WeightMap } from "shuffle-duplication"
import { randomNeedle, randomNeedles } from "shuffle-duplication"
import { Emotion } from "../types"
import { Stat } from "../types/enum/Game"
import {
  CraftableItemsNoScarves,
  CraftableNoStonesOrScarves,
  Item,
  ItemComponentsNoFossilOrScarf,
  ShinyItems,
  ItemInteger,
  ItemByInteger,
} from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import {
  PRNG_P_OFFSET_ITEM_PICK,
  PRNG_P_OFFSET_ITEM_FREE,
  PRNG_P_OFFSET_BERRY_TREE,
} from "../utils/random"
import { schemaValues } from "../utils/schemas"
import type Player from "./colyseus-models/player"

export type PVEStagesNames =
  | `pkm.${Pkm}`
  | "tower_duo"
  | "legendary_birds"
  | "legendary_beasts"
  | "super_ancients"
  | "legendary_giants"

export type PVEStage = {
  name: PVEStagesNames
  avatar: Pkm
  emotion?: Emotion
  shinyChance?: number
  rewards?: Item[]
  getRewards?: (player: Player, shinyEncounter: boolean) => Item[]
  getRewardsPropositions?: (player: Player, shinyEncounter: boolean) => Item[]
  board: [pkm: Pkm, x: number, y: number][]
  marowakItems?: Item[][]
  statBoosts?: { [stat in Stat]?: number }
}

const WEIGHTS_FOR_CHARCADET_ARMOR: WeightMap = {}
WEIGHTS_FOR_CHARCADET_ARMOR[ItemInteger[Item.AUSPICIOUS_ARMOR] + PRNG_P_OFFSET_BERRY_TREE] = 1
WEIGHTS_FOR_CHARCADET_ARMOR[ItemInteger[Item.MALICIOUS_ARMOR] + PRNG_P_OFFSET_BERRY_TREE] = 1

export const PVEStages: { [turn: number]: PVEStage } = {
  1: {
    name: "pkm.MAGIKARP",
    avatar: Pkm.MAGIKARP,
    board: [
      [Pkm.MAGIKARP, 3, 1],
      [Pkm.MAGIKARP, 5, 1]
    ],
    shinyChance: 1 / 40,
    rewards: ItemComponentsNoFossilOrScarf,
    getRewards(player: Player) {
      const randomComponent = ItemByInteger[parseInt(
        randomNeedle(player.rngState, Object.fromEntries(
          ItemComponentsNoFossilOrScarf.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_FREE, 1])
        ))!
      ) - PRNG_P_OFFSET_ITEM_FREE]
      player.randomComponentsGiven.push(randomComponent)
      return [randomComponent]
    }
  },

  2: {
    name: "pkm.RATTATA",
    avatar: Pkm.RATTATA,
    board: [
      [Pkm.RATTATA, 3, 1],
      [Pkm.RATTATA, 5, 1]
    ],
    rewards: ItemComponentsNoFossilOrScarf,
    getRewardsPropositions(player: Player) {
      return randomNeedles(player.rngState, Object.fromEntries(
        ItemComponentsNoFossilOrScarf.filter(item => !player.randomComponentsGiven.includes(item))
          .map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1])
      ), 3, false).map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  3: {
    name: "pkm.SPEAROW",
    avatar: Pkm.SPEAROW,
    board: [
      [Pkm.SPEAROW, 3, 1],
      [Pkm.SPEAROW, 5, 1],
      [Pkm.SPEAROW, 4, 2]
    ],
    rewards: ItemComponentsNoFossilOrScarf,
    getRewards(player) {
      const randomComponent = ItemByInteger[parseInt(
        randomNeedle(player.rngState, Object.fromEntries(
          ItemComponentsNoFossilOrScarf.filter(item => !player.randomComponentsGiven.includes(item))
            .map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_FREE, 1])
        ))!
      ) - PRNG_P_OFFSET_ITEM_FREE]
      player.randomComponentsGiven.push(randomComponent)
      return [randomComponent]
    }
  },

  9: {
    name: "pkm.GYARADOS",
    avatar: Pkm.GYARADOS,
    board: [[Pkm.GYARADOS, 4, 2]],
    marowakItems: [[Item.KINGS_ROCK]],
    shinyChance: 1 / 40,
    rewards: [...ItemComponentsNoFossilOrScarf, Item.RED_SCALE],
    getRewards(player: Player, shinyEncounter: boolean) {
      return [shinyEncounter ? Item.RED_SCALE : ItemByInteger[parseInt(
        randomNeedle(player.rngState, Object.fromEntries(
          ItemComponentsNoFossilOrScarf.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_FREE, 1])
        ))!
      ) - PRNG_P_OFFSET_ITEM_FREE]]
    }
  },

  14: {
    name: "pkm.MEWTWO",
    avatar: Pkm.MEWTWO,
    emotion: Emotion.DETERMINED,
    board: [
      [Pkm.MEWTWO, 0, 1],
      [Pkm.MEW, 7, 1]
    ],
    marowakItems: [[Item.METAL_COAT], [Item.DEEP_SEA_TOOTH]],
    shinyChance: 1 / 100,
    rewards: ItemComponentsNoFossilOrScarf,
    getRewards(player: Player) {
      const rewards: Item[] = []
      if (
        schemaValues(player.board).some((p) => p.name === Pkm.CHARCADET) ||
        player.pokemonsTrainingInDojo.some(
          (p) => p.pokemon.name === Pkm.CHARCADET
        )
      ) {
        const psyLevel = player.synergies.get(Synergy.PSYCHIC) || 0
        const ghostLevel = player.synergies.get(Synergy.GHOST) || 0
        const armorReceived =
          psyLevel > ghostLevel
            ? Item.AUSPICIOUS_ARMOR
            : psyLevel < ghostLevel
              ? Item.MALICIOUS_ARMOR
              : ItemByInteger[parseInt(randomNeedle(player.rngState, WEIGHTS_FOR_CHARCADET_ARMOR)!) - PRNG_P_OFFSET_BERRY_TREE]
        rewards.push(armorReceived)
      }
      return rewards
    },
    getRewardsPropositions(player: Player, shinyEncounter: boolean) {
      const weights: WeightMap = {}
      if (shinyEncounter) {
        for (const item of ShinyItems) {
          if (item !== Item.RED_SCALE) {
            weights[ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK] = 1
          }
        }
      } else {
        for (const item of ItemComponentsNoFossilOrScarf) {
          weights[ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK] = 1
        }
        weights[ItemInteger[Item.FOSSIL_STONE] + PRNG_P_OFFSET_ITEM_PICK] = 1
      }
      return randomNeedles(player.rngState, weights, 3, false).map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  19: {
    name: "tower_duo",
    avatar: Pkm.LUGIA,
    emotion: Emotion.DETERMINED,
    board: [
      [Pkm.LUGIA, 3, 1],
      [Pkm.HO_OH, 5, 1]
    ],
    statBoosts: {
      [Stat.HP]: 50,
      [Stat.DEF]: 5,
      [Stat.SPE_DEF]: 5
    },
    marowakItems: [[Item.COMET_SHARD], [Item.SACRED_ASH]],
    rewards: ItemComponentsNoFossilOrScarf,
    getRewards(player: Player) {
      const randomComponentsGiven = randomNeedles(player.rngState, Object.fromEntries(
        ItemComponentsNoFossilOrScarf.map(item => [
          ItemInteger[item] + PRNG_P_OFFSET_ITEM_FREE,
          player.randomComponentsGiven.includes(item) ? 1 : 2 // twice the weight if the player doesn't have it yet
        ])
      ), 2, true).map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_FREE])
      player.randomComponentsGiven.push(...randomComponentsGiven)
      return randomComponentsGiven
    }
  },

  24: {
    name: "legendary_birds",
    avatar: Pkm.ZAPDOS,
    board: [
      [Pkm.ZAPDOS, 2, 2],
      [Pkm.MOLTRES, 4, 2],
      [Pkm.ARTICUNO, 6, 2]
    ],
    statBoosts: {
      [Stat.HP]: 100,
      [Stat.DEF]: 10,
      [Stat.SPE_DEF]: 10,
      [Stat.AP]: 50
    },
    marowakItems: [
      [Item.XRAY_VISION, Item.BLUE_ORB],
      [Item.SOUL_DEW, Item.POKEMONOMICON],
      [Item.AQUA_EGG, Item.STAR_DUST]
    ],
    rewards: CraftableItemsNoScarves,
    getRewards(player: Player) {
      for (const p of schemaValues(player.board)) {
        if (p.name === Pkm.ZACIAN) {
          return [Item.RUSTED_SWORD]
        }
      }
      return []
    },
    getRewardsPropositions(player: Player) {
      const thirdChoiceWeights = Object.fromEntries(CraftableItemsNoScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1]))
      const needleIds: string[] = randomNeedles(player.rngState, Object.fromEntries(
        CraftableNoStonesOrScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1])
      ), 2, false)
      for (const needleId of needleIds) {
        delete thirdChoiceWeights[needleId]
      }
      needleIds.push(randomNeedle(player.rngState, thirdChoiceWeights)!)
      return needleIds.map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  28: {
    name: "legendary_beasts",
    avatar: Pkm.SUICUNE,
    emotion: Emotion.DETERMINED,
    board: [
      [Pkm.ENTEI, 2, 2],
      [Pkm.RAIKOU, 4, 2],
      [Pkm.SUICUNE, 6, 2]
    ],
    statBoosts: {
      [Stat.HP]: 100,
      [Stat.DEF]: 10,
      [Stat.SPE_DEF]: 10,
      [Stat.ATK]: 10,
      [Stat.SPEED]: 10,
      [Stat.PP]: 80,
      [Stat.AP]: 50
    },
    marowakItems: [
      [Item.ASSAULT_VEST, Item.ROCKY_HELMET],
      [Item.XRAY_VISION, Item.PUNCHING_GLOVE],
      [Item.DEEP_SEA_TOOTH, Item.CHOICE_SPECS]
    ],
    rewards: CraftableItemsNoScarves,
    getRewardsPropositions(player: Player) {
      const thirdChoiceWeights = Object.fromEntries(CraftableItemsNoScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1]))
      const needleIds: string[] = randomNeedles(player.rngState, Object.fromEntries(
        CraftableNoStonesOrScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1])
      ), 2, false)
      for (const needleId of needleIds) {
        delete thirdChoiceWeights[needleId]
      }
      needleIds.push(randomNeedle(player.rngState, thirdChoiceWeights)!)
      return needleIds.map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  32: {
    name: "super_ancients",
    avatar: Pkm.RAYQUAZA,
    emotion: Emotion.DETERMINED,
    board: [
      [Pkm.PRIMAL_KYOGRE, 2, 2],
      [Pkm.MEGA_RAYQUAZA, 4, 2],
      [Pkm.PRIMAL_GROUDON, 6, 2]
    ],
    statBoosts: {
      [Stat.HP]: 200,
      [Stat.DEF]: 15,
      [Stat.SPE_DEF]: 15,
      [Stat.ATK]: 10
    },
    marowakItems: [
      [Item.BLUE_ORB, Item.AQUA_EGG, Item.SOUL_DEW],
      [Item.GREEN_ORB, Item.STAR_DUST, Item.POWER_LENS],
      [Item.RED_ORB, Item.FLAME_ORB, Item.PROTECTIVE_PADS]
    ],
    rewards: CraftableItemsNoScarves,
    getRewardsPropositions(player: Player) {
      const thirdChoiceWeights = Object.fromEntries(CraftableItemsNoScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1]))
      const needleIds: string[] = randomNeedles(player.rngState, Object.fromEntries(
        CraftableNoStonesOrScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1])
      ), 2, false)
      for (const needleId of needleIds) {
        delete thirdChoiceWeights[needleId]
      }
      needleIds.push(randomNeedle(player.rngState, thirdChoiceWeights)!)
      return needleIds.map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  36: {
    name: "legendary_giants",
    avatar: Pkm.REGICE,
    emotion: Emotion.DETERMINED,
    board: [
      [Pkm.REGIELEKI, 1, 3],
      [Pkm.REGICE, 2, 3],
      [Pkm.REGIGIGAS, 3, 3],
      [Pkm.REGIROCK, 4, 3],
      [Pkm.REGISTEEL, 5, 3],
      [Pkm.REGIDRAGO, 6, 3]
    ],
    statBoosts: {
      [Stat.HP]: 50
    },
    marowakItems: [
      [],
      [Item.ABILITY_SHIELD, Item.GRACIDEA_FLOWER, Item.GREEN_ORB],
      [Item.DYNAMAX_BAND],
      [Item.ABILITY_SHIELD, Item.GRACIDEA_FLOWER, Item.GREEN_ORB],
      [Item.ABILITY_SHIELD, Item.GRACIDEA_FLOWER, Item.GREEN_ORB],
      []
    ],
    rewards: CraftableItemsNoScarves,
    getRewardsPropositions(player: Player) {
      const thirdChoiceWeights = Object.fromEntries(CraftableItemsNoScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1]))
      const needleIds: string[] = randomNeedles(player.rngState, Object.fromEntries(
        CraftableNoStonesOrScarves.map(item => [ItemInteger[item] + PRNG_P_OFFSET_ITEM_PICK, 1])
      ), 2, false)
      for (const needleId of needleIds) {
        delete thirdChoiceWeights[needleId]
      }
      needleIds.push(randomNeedle(player.rngState, thirdChoiceWeights)!)
      return needleIds.map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_ITEM_PICK])
    }
  },

  40: {
    name: "pkm.ARCEUS",
    avatar: Pkm.ARCEUS,
    emotion: Emotion.INSPIRED,
    board: [
      [Pkm.DIALGA, 2, 3],
      [Pkm.GIRATINA, 4, 3],
      [Pkm.PALKIA, 6, 3],
      [Pkm.ARCEUS, 4, 1]
    ],
    statBoosts: {
      [Stat.HP]: 200,
      [Stat.DEF]: 15,
      [Stat.SPE_DEF]: 15,
      [Stat.ATK]: 10,
      [Stat.AP]: 50
    },
    marowakItems: [
      [Item.DYNAMAX_BAND],
      [Item.DYNAMAX_BAND],
      [Item.DYNAMAX_BAND],
      [Item.DYNAMAX_BAND]
    ],
    rewards: [Item.RARE_CANDY, Item.SACRED_ASH, Item.GOLD_BOW],
    getRewards(player: Player) {
      return [Item.RARE_CANDY, Item.SACRED_ASH, Item.GOLD_BOW]
    }
  }
}
