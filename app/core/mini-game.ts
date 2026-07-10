import type { MapSchema } from "@colyseus/schema"
import {
  Bodies,
  Body,
  Composite,
  Constraint,
  Engine,
  Events,
  Vector
} from "matter-js"
import {
  ItemCarouselStages,
  PortalCarouselStages,
  RegionDetails,
  TownEncounterSellPrice,
  TownEncountersByStage
} from "../config"
import { FloatingItem } from "../models/colyseus-models/floating-item"
import type Player from "../models/colyseus-models/player"
import { PlayerChoice } from "../models/colyseus-models/player-choice"
import { PokemonAvatarModel } from "../models/colyseus-models/pokemon-avatar"
import { Portal, SynergySymbol } from "../models/colyseus-models/portal"
import { getSynergyStep } from "../models/colyseus-models/synergies"
import { createPcg32, randomInt, getOutput, stepState } from "pcg"
import { createHaystack, randomNeedle, randomNeedles, randomNeedleFromHaystacks } from "shuffle-duplication"
import type { Haystack, WeightMap } from "shuffle-duplication"
import type GameRoom from "../rooms/game-room"
import type GameState from "../rooms/states/game-state"
import {
  MemoryDiscs,
  SynergyGivenByItem,
  SynergyItems,
  Transfer
} from "../types"
import { DungeonPMDO, DungeonInteger, DungeonByInteger } from "../types/enum/Dungeon"
import { PokemonActionState } from "../types/enum/Game"
import { PkmInteger, PkmByInteger } from "../types/enum/Pokemon"
import {
  CraftableItemsNoScarves,
  CraftableNoStonesOrScarves,
  Item,
  ItemComponentsNoFossilOrScarf,
  MissionOrders,
  NonSpecialBerries,
  SynergyGems,
  SynergyGivenByGem,
  SynergyStones,
  Tools,
  ItemInteger,
  ItemByInteger,
} from "../types/enum/Item"
import { SpecialGameRule } from "../types/enum/SpecialGameRule"
import { Synergy, SynergyArray, SynergyInteger, SynergyByInteger } from "../types/enum/Synergy"
import { type TownEncounter, TownEncounters } from "../types/enum/TownEncounter"
import type { NpcDialog } from "../types/strings/NpcDialog"
import { isIn } from "../utils/array"
import { clamp, max } from "../utils/number"
import { getOrientation } from "../utils/orientation"
import {
  chance,
  pickNRandomIn,
  pickRandomIn,
  randomBetween,
  shuffleArray,
  pcgRandomUint64,
  PRNG_SUBOFFSET,
  PRNG_N_ENCOUNTER_MAGNEZONE_OUTLAW_STAGE,
  STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER,
  STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE,
  PRNG_N_PORTAL_SYMBOL_SEED,
  PRNG_N_OFFSET_TOWN_ENCOUNTER,
  PRNG_N_OFFSET_CAROUSEL_ITEM,
  PRNG_N_OFFSET_CAROUSEL_MAP,
  PRNG_P_CAROUSEL_POS,
  PRNG_P_OFFSET_CAROUSEL_SYNERGY,
  PRNG_P_OFFSET_BERRY_TREE,
} from "../utils/random"
import { schemaKeys, schemaValues } from "../utils/schemas"
import { giveRandomEgg } from "./eggs"
import { spawnDIAYAvatar } from "./scribbles"

const PLAYER_VELOCITY = 2
const ITEM_ROTATION_SPEED = 0.0004
const PORTAL_ROTATION_SPEED = 0.0003
const SYMBOL_ROTATION_SPEED = 0.0006
const CAROUSEL_RADIUS_X = 150
const CAROUSEL_RADIUS_Y = 125
const AVATAR_RADIUS = 25
const NB_SYMBOLS_PER_PLAYER = 4

const WEIGHTS_FOR_EXTRA_FOSSIL_STONE: WeightMap = {}
WEIGHTS_FOR_EXTRA_FOSSIL_STONE[PRNG_N_OFFSET_CAROUSEL_ITEM] = 0.6 // PRNG_N_OFFSET_CAROUSEL_ITEM + 0 means none
WEIGHTS_FOR_EXTRA_FOSSIL_STONE[STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE] = 0.4

export class MiniGame {
  avatars: MapSchema<PokemonAvatarModel> | undefined
  items: MapSchema<FloatingItem> | undefined
  portals: MapSchema<Portal> | undefined
  symbols: MapSchema<SynergySymbol> | undefined
  symbolsByPortal: Map<string, SynergySymbol[]> = new Map()
  bodies: Map<string, Body>
  alivePlayers: Player[]
  engine: Engine
  centerX: number = 335
  centerY: number = 235
  timeElapsed: number = 0
  rotationDirection: number = 1

  constructor(room: GameRoom) {
    this.engine = Engine.create({ gravity: { x: 0, y: 0 } })
    this.bodies = new Map<string, Body>()
    this.alivePlayers = []
    Composite.add(
      this.engine.world,
      // bottom wall
      Bodies.rectangle(-50, -70, 2000, 40, {
        isStatic: true,
        restitution: 1
      })
    )
    Composite.add(
      this.engine.world,
      // left wall
      Bodies.rectangle(-70, 0, 40, 2000, {
        isStatic: true,
        restitution: 1
      })
    )
    Composite.add(
      this.engine.world,
      // right wall
      Bodies.rectangle(740, 0, 40, 2000, {
        isStatic: true,
        restitution: 1
      })
    )
    Composite.add(
      this.engine.world,
      // up wall
      Bodies.rectangle(-50, 540, 2000, 40, {
        isStatic: true,
        restitution: 1
      })
    )
    Events.on(this.engine, "beforeUpdate", () => {
      this.items?.forEach((item) => {
        if (item.avatarId === "") {
          const itemBody = this.bodies.get(item.id)
          if (itemBody) {
            const t = this.timeElapsed * ITEM_ROTATION_SPEED
            const x =
              this.centerX +
              Math.cos(t + (Math.PI * 2 * item.index) / this.items!.size) *
                CAROUSEL_RADIUS_X
            const y =
              this.centerY +
              Math.sin(t + (Math.PI * 2 * item.index) / this.items!.size) *
                CAROUSEL_RADIUS_Y
            Body.setPosition(itemBody, { x, y })
          }
        }
      })

      this.portals?.forEach((portal) => {
        if (portal.avatarId === "") {
          const portalBody = this.bodies.get(portal.id)
          if (portalBody) {
            const t = this.timeElapsed * PORTAL_ROTATION_SPEED
            const x =
              this.centerX +
              Math.cos(t + (Math.PI * 2 * portal.index) / this.portals!.size) *
                CAROUSEL_RADIUS_X
            const y =
              this.centerY +
              Math.sin(t + (Math.PI * 2 * portal.index) / this.portals!.size) *
                CAROUSEL_RADIUS_Y
            Body.setPosition(portalBody, { x, y })
          }
        }
      })
    })

    Events.on(this.engine, "collisionStart", (event) => {
      event.pairs.forEach(({ bodyA, bodyB }) => {
        if (
          (this.items?.has(bodyA.label) && this.avatars?.has(bodyB.label)) ||
          (this.avatars?.has(bodyA.label) && this.items?.has(bodyB.label))
        ) {
          // when avatar collides with an item
          const avatarBody = this.avatars?.has(bodyA.label) ? bodyA : bodyB
          const itemBody = this.items?.has(bodyA.label) ? bodyA : bodyB
          const avatar = this.avatars.get(avatarBody.label)
          const item = this.items.get(itemBody.label)
          const encounter = room.state.townEncounter

          if (avatar?.itemId === "" && item?.avatarId === "") {
            if (encounter && encounter in TownEncounterSellPrice) {
              const player = room.state.players.get(avatar.id)
              const client = room.clients.find(
                (cli) => cli.auth.uid === avatar.id
              )
              const price =
                room.state.specialGameRule === SpecialGameRule.TOWN_FESTIVAL
                  ? 0
                  : TownEncounterSellPrice[encounter]!
              if ((player?.money ?? 0) < price) {
                // too poor to buy one item from kecleon's shop
                client?.send(Transfer.NPC_DIALOG, {
                  npc: encounter,
                  dialog: "tell_price" satisfies NpcDialog,
                  price: price
                })
                return
              } else {
                client?.send(Transfer.NPC_DIALOG, {
                  npc: encounter,
                  dialog: "thank_you" satisfies NpcDialog
                })
                if (player) {
                  player.money -= price
                }
              }
            }

            const constraint = Constraint.create({
              bodyA: avatarBody,
              bodyB: itemBody
            })
            Composite.add(this.engine.world, constraint)
            avatar.itemId = item.id
            item.avatarId = avatar.id

            itemBody.collisionFilter.mask = 0 // item no longer collide
            avatarBody.collisionFilter.mask = 0 // player no longer collide after taking an item

            const player = this.alivePlayers.find((p) => p.id === avatar!.id)
            if (player && player.isBot) {
              // make bots return to outer circle
              const i = this.alivePlayers.indexOf(player)
              avatar.targetX =
                this.centerX +
                Math.cos((2 * Math.PI * i) / this.alivePlayers.length) * 300
              avatar.targetY =
                this.centerY +
                Math.sin((2 * Math.PI * i) / this.alivePlayers.length) * 250
            }
          }
        }

        if (
          (this.portals?.has(bodyA.label) && this.avatars?.has(bodyB.label)) ||
          (this.avatars?.has(bodyA.label) && this.portals?.has(bodyB.label))
        ) {
          // when avatar collides with a portal
          const avatarBody = this.avatars?.has(bodyA.label) ? bodyA : bodyB
          const portalBody = this.portals?.has(bodyA.label) ? bodyA : bodyB
          const avatar = this.avatars.get(avatarBody.label)
          const portal = this.portals.get(portalBody.label)

          if (avatar?.portalId === "" && portal?.avatarId === "") {
            //logger.debug(`${avatar.name} is taking portal ${portal.id}`)
            portal.avatarId = avatar.id
            avatar.portalId = portal.id
            Composite.remove(this.engine.world, avatarBody)
            Composite.remove(this.engine.world, portalBody)
            this.bodies.delete(avatar.id)
            this.bodies.delete(portal.id)
          }
        }
      })
    })
  }

  create(
    avatars: MapSchema<PokemonAvatarModel>,
    items: MapSchema<FloatingItem>,
    portals: MapSchema<Portal>,
    symbols: MapSchema<SynergySymbol>
  ) {
    this.avatars = avatars
    this.items = items
    this.portals = portals
    this.symbols = symbols
  }

  initialize(state: GameState, room: GameRoom) {
    const { nonPlayerRngState, players, stageLevel } = state
    this.timeElapsed = 0
    this.rotationDirection = 1

    if (stageLevel in TownEncountersByStage) {
      const weights: WeightMap = {}
      if (state.specialGameRule === SpecialGameRule.TOWN_FESTIVAL) {
        for (const [pkmId, weight] of Object.entries(TownEncountersByStage[stageLevel])) {
          weights[PkmInteger[pkmId] + PRNG_N_OFFSET_TOWN_ENCOUNTER] = weight
        }
      } else {
        let weightTotal = 0.0
        for (const [pkmId, weight] of Object.entries(TownEncountersByStage[stageLevel])) {
          if (!state.townEncounters.has(pkmId as TownEncounter)) {
            weights[PkmInteger[pkmId] + PRNG_N_OFFSET_TOWN_ENCOUNTER] = weight
            weightTotal += weight
          }
        }
        weights[PRNG_N_OFFSET_TOWN_ENCOUNTER] = 1.0 - weightTotal
      }
      const outcome = randomNeedle(nonPlayerRngState, weights)
      if (outcome === null || outcome === PRNG_N_OFFSET_TOWN_ENCOUNTER.toString()) {
        state.townEncounter = null
      } else {
        state.townEncounter = PkmByInteger[parseInt(outcome) - PRNG_N_OFFSET_TOWN_ENCOUNTER] as TownEncounter
        // add a fixed blocked circle collision body around encounter
        const body = Bodies.circle(this.centerX, this.centerY, 20, {
          isStatic: true,
          collisionFilter: {
            mask: 1
          }
        })
        Composite.add(this.engine.world, body)
        this.bodies.set("encounter", body)
      }
    } else {
      state.townEncounter = null
    }

    this.alivePlayers = new Array<Player>()
    const carouselPos = new Map<string, number>()
    players.forEach((p) => {
      if (p.alive) {
        this.alivePlayers.push(p)
        carouselPos.set(p.id, getOutput(createPcg32({}, p.rngState.seed, PRNG_P_CAROUSEL_POS)))
      }
    })
    this.alivePlayers.sort((a, b) => carouselPos.get(a.id)! - carouselPos.get(b.id)!)
    this.alivePlayers.forEach((player, i) => {
      const x =
        this.centerX +
        Math.cos((2 * Math.PI * i) / this.alivePlayers.length) * 300
      const y =
        this.centerY +
        Math.sin((2 * Math.PI * i) / this.alivePlayers.length) * 250
      let retentionDelay =
        (state.townEncounter ? 10000 : 5000) +
        (this.alivePlayers.length - player.rank) * 2000

      if (stageLevel === 0) {
        retentionDelay = 12000
      } else if (PortalCarouselStages.includes(stageLevel)) {
        retentionDelay = 8000
      } else if (stageLevel < 5) {
        retentionDelay = state.townEncounter ? 10000 : 5000
      }

      if (player.isBot) {
        retentionDelay += randomBetween(1000, 6000)
      }

      const avatar = new PokemonAvatarModel(
        player.id,
        player.avatar,
        x,
        y,
        retentionDelay
      )

      if (player.isBot) {
        avatar.targetX =
          this.centerX +
          Math.cos((2 * Math.PI * i) / this.alivePlayers.length) *
            CAROUSEL_RADIUS_X
        avatar.targetY =
          this.centerY +
          Math.sin((2 * Math.PI * i) / this.alivePlayers.length) *
            CAROUSEL_RADIUS_Y
      }

      this.avatars!.set(avatar.id, avatar)
      const body = Bodies.circle(x, y, AVATAR_RADIUS)
      body.label = avatar.id
      body.collisionFilter.mask = 0 // disable collision until release time
      this.bodies.set(avatar.id, body)
      Composite.add(this.engine.world, body)
    })

    if (PortalCarouselStages.includes(stageLevel)) {
      this.initializePortalCarousel(stageLevel, room)
      room.broadcast(
        Transfer.PRELOAD_MAPS,
        schemaValues(this.portals!).map((p) => p.map)
      )
    } else if (ItemCarouselStages.includes(stageLevel)) {
      this.initializeItemsCarousel(state)
    }

    if (state.townEncounter === TownEncounters.SPINDA) {
      this.rotationDirection = chance(1 / 2) ? 1.5 : -1.5
      for (let i = 0; i < randomBetween(1, 3); i++) {
        room.clock.setTimeout(
          () => {
            room.broadcast(Transfer.NPC_DIALOG, {
              npc: TownEncounters.SPINDA
            })
            this.rotationDirection *= -1
          },
          randomBetween(5000, 14000)
        )
      }
    } else if (state.townEncounter === TownEncounters.REGIROCK) {
      this.alivePlayers.forEach((player) => {
        player.life += 15
      })
    } else if (state.townEncounter === TownEncounters.WOBBUFFET) {
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.RECYCLE_TICKET)
      })
    } else if (state.townEncounter === TownEncounters.CROAGUNK) {
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.EXCHANGE_TICKET)
      })
    } else if (state.townEncounter === TownEncounters.MUNCHLAX) {
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.PICNIC_SET)
      })
    } else if (state.townEncounter === TownEncounters.XATU) {
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.TREASURE_BOX)
      })
    } else if (state.townEncounter === TownEncounters.MAKUHITA) {
      const ticket =
        state.stageLevel >= 15
          ? Item.GOLD_DOJO_TICKET
          : state.stageLevel >= 10
            ? Item.SILVER_DOJO_TICKET
            : Item.BRONZE_DOJO_TICKET
      this.alivePlayers.forEach((player) => {
        player.items.push(ticket)
      })
    } else if (state.townEncounter === TownEncounters.MAGNEZONE) {
      state.outlawStage = randomInt(5, 16, stepState(stageLevel, createPcg32({}, nonPlayerRngState.seed, PRNG_N_ENCOUNTER_MAGNEZONE_OUTLAW_STAGE)))[0] // randomInt is [min, max)
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.WANTED_NOTICE)
      })
    } else if (state.townEncounter === TownEncounters.KINGAMBIT) {
      const highestLifePlayer = this.alivePlayers.reduce((prev, current) =>
        prev.life > current.life ? prev : current
      )
      highestLifePlayer.items.push(Item.LEADERS_CREST)
    } else if (state.townEncounter === TownEncounters.LAPRAS) {
      this.alivePlayers.forEach((player) => {
        player.items.push(Item.LAPRAS_PASSPORT)
      })
    }
  }

  initializeItemsCarousel(state: GameState) {
    const items = this.pickRandomItems(state)

    for (let j = 0; j < items.length; j++) {
      const x = this.centerX + Math.cos((Math.PI * 2 * j) / items.length) * 100
      const y = this.centerY + Math.sin((Math.PI * 2 * j) / items.length) * 90
      const name = items[j]
      const floatingItem = new FloatingItem(name, x, y, j)
      this.items?.set(floatingItem.id, floatingItem)
      const body = Bodies.circle(x, y, 20)
      body.label = floatingItem.id
      body.isSensor = true
      this.bodies.set(floatingItem.id, body)
      Composite.add(this.engine.world, body)
    }
  }

  initializePortalCarousel(stageLevel: number, room: GameRoom) {
    const nbPortals = clamp(this.alivePlayers.length + 1, 3, 9)
    for (let i = 0; i < nbPortals; i++) {
      const x = this.centerX + Math.cos((Math.PI * 2 * i) / nbPortals) * 115
      const y = this.centerY + Math.sin((Math.PI * 2 * i) / nbPortals) * 115
      const portal = new Portal(x, y, i)
      this.portals?.set(portal.id, portal)
      const body = Bodies.circle(x, y, 30)
      body.label = portal.id
      body.isSensor = true
      this.bodies.set(portal.id, body)
      Composite.add(this.engine.world, body)
    }

    this.pickRandomSynergySymbols(stageLevel, room)
  }

  update(dt: number) {
    this.timeElapsed += dt * this.rotationDirection
    Engine.update(this.engine, dt)
    this.avatars?.forEach((a) => {
      if (a.timer > 0) {
        a.timer = a.timer - dt
      }
    })
    this.bodies.forEach((body, id) => {
      if (
        body.position.x < 0 ||
        body.position.x > 720 ||
        body.position.y < 0 ||
        body.position.y > 590
      ) {
        // prevent going out of bounds in case of lag
        Body.setPosition(body, {
          x: clamp(body.position.x, -50 + AVATAR_RADIUS, 740 - AVATAR_RADIUS),
          y: clamp(body.position.y, -70 + AVATAR_RADIUS, 540 - AVATAR_RADIUS)
        })
      }
      if (this.avatars?.has(id)) {
        const avatar = this.avatars.get(id)!
        avatar.x = body.position.x
        avatar.y = body.position.y
        this.updatePlayerVector(id)
      } else if (this.items?.has(id)) {
        const item = this.items.get(id)!
        item.x = body.position.x
        item.y = body.position.y
      } else if (this.portals?.has(id)) {
        const portal = this.portals.get(id)!
        portal.x = body.position.x
        portal.y = body.position.y
        const symbols = this.symbolsByPortal.get(portal.id) ?? []
        symbols.forEach((symbol) => {
          symbol.x =
            portal.x +
            Math.cos(
              this.timeElapsed * SYMBOL_ROTATION_SPEED +
                (Math.PI * 2 * symbol.index) / symbols.length
            ) *
              25
          symbol.y =
            portal.y +
            Math.sin(
              this.timeElapsed * SYMBOL_ROTATION_SPEED +
                (Math.PI * 2 * symbol.index) / symbols.length
            ) *
              25
        })
      }
    })
  }

  pickRandomItems(state: GameState): Item[] {
    const nonPlayerRngState = state.nonPlayerRngState
    const stageLevel = state.stageLevel
    const encounter = state.townEncounter
    const items: Item[] = []

    let nbItemsToPick = clamp(this.alivePlayers.length + 3, 5, 9)
    let maxCopiesPerItem = 2
    let itemsSet: readonly Item[] = ItemComponentsNoFossilOrScarf

    if (stageLevel >= 20) {
      // Carousels after stage 20 propose full items and no longer components, and have one more proposition
      nbItemsToPick += 1
      maxCopiesPerItem = 1
      itemsSet = CraftableItemsNoScarves
    }

    if (encounter === TownEncounters.KECLEON) {
      const topSynergies = schemaValues(state.players).flatMap((p) =>
        p.synergies.getTopSynergies(3)
      )
      itemsSet = SynergyItems.filter(
        (i) =>
          !isIn(MemoryDiscs, i) &&
          i !== Item.SHINY_STONE &&
          isIn(topSynergies, SynergyGivenByItem[i])
      )
      maxCopiesPerItem = 2
    }

    if (encounter === TownEncounters.KANGASKHAN) {
      itemsSet = CraftableNoStonesOrScarves
      maxCopiesPerItem = 1
    }

    if (encounter === TownEncounters.ELECTIVIRE) {
      itemsSet = Tools
      maxCopiesPerItem = 2
    }

    if (encounter === TownEncounters.CHANSEY) {
      itemsSet = [Item.EGG_FOR_SELL]
      nbItemsToPick = this.alivePlayers.length
      maxCopiesPerItem = 99
    }

    if (encounter === TownEncounters.DUSKULL) {
      items.push(
        Item.GIMMIGHOUL_COIN,
        Item.GIMMIGHOUL_COIN,
        Item.GIMMIGHOUL_COIN,
        Item.GIMMIGHOUL_COIN
      )
    }

    if (encounter === TownEncounters.MEOWTH) {
      items.push(
        Item.AMULET_COIN,
        Item.AMULET_COIN,
        Item.AMULET_COIN,
        Item.AMULET_COIN
      )
    }

    if (encounter === TownEncounters.CINCCINO) {
      items.push(
        Item.SILK_SCARF,
        Item.SILK_SCARF,
        Item.SILK_SCARF,
        Item.SILK_SCARF
      )
    }

    if (encounter === TownEncounters.LUDICOLO) {
      items.push(
        Item.AQUA_MONICA,
        Item.FIERY_DRUM,
        Item.GRASS_CORNET,
        Item.ICY_FLUTE,
        Item.ROCK_HORN,
        Item.SKY_MELODICA,
        Item.TERRA_CYMBAL
      )
      nbItemsToPick -= 1
    }

    if (encounter === TownEncounters.SABLEYE) {
      const weights: WeightMap = {}
      for (const item of SynergyGems) {
        weights[ItemInteger[item] + PRNG_N_OFFSET_CAROUSEL_ITEM] = 1
      }
      const needleIds = randomNeedles(nonPlayerRngState, weights, 4, false)
      for (const needleId of needleIds) {
        items.push(ItemByInteger[parseInt(needleId) - PRNG_N_OFFSET_CAROUSEL_ITEM])
      }
    }

    const outcomeIds = itemsSet.map(item => ItemInteger[item] + PRNG_N_OFFSET_CAROUSEL_ITEM)
    const outcomeCounts: Record<string, number> = {}
    let eligible = outcomeIds.length
    let eligibleWeight = 1 / outcomeIds.length
    let ineligibleWeight = 0
    if (itemsSet !== CraftableItemsNoScarves) {
      // normal case
      if (itemsSet === ItemComponentsNoFossilOrScarf && randomNeedle(nonPlayerRngState, WEIGHTS_FOR_EXTRA_FOSSIL_STONE) === STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE) {
        items.push(Item.FOSSIL_STONE)
      }
      for (let i = 0; i < nbItemsToPick; i++) {
        const weights = Object.fromEntries(outcomeIds.map(id =>
          [id, outcomeCounts[id] && outcomeCounts[id] >= maxCopiesPerItem ? ineligibleWeight : eligibleWeight]))
        const outcome = randomNeedle(nonPlayerRngState, weights)!
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
        if (outcomeCounts[outcome] === maxCopiesPerItem) {
          eligible -= 1
          const ineligible = outcomeIds.length - eligible
          ineligibleWeight = (ineligible / outcomeIds.length) ** 10
          eligibleWeight = (1 - ineligibleWeight) / eligible // when eligible is 0, eligibleWeight is unused
          ineligibleWeight /= ineligible
        } // Xom: This replicates the probabilities resulting from the original logic that tries 10 times to pick an eligible item
      }
    } else {
      // special case for itemsSet === CraftableItemsNoScarves
      let synergyStones = 0
      let ineligibleStones = 0
      let i = 0
      while (i < nbItemsToPick) {
        const weights = Object.fromEntries(outcomeIds.map(id =>
          [id, outcomeCounts[id] && outcomeCounts[id] >= maxCopiesPerItem ? ineligibleWeight : eligibleWeight]))
        const outcome = randomNeedle(nonPlayerRngState, weights)!
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
        i += 1
        if (outcomeCounts[outcome] === maxCopiesPerItem) {
          eligible -= 1
          const ineligible = outcomeIds.length - eligible
          ineligibleWeight = (ineligible / outcomeIds.length) ** 10
          eligibleWeight = (1 - ineligibleWeight) / eligible // eligible won't be 0 because there's many stones
          ineligibleWeight /= ineligible
        }
        if (isIn(SynergyStones, ItemByInteger[parseInt(outcome) - PRNG_N_OFFSET_CAROUSEL_ITEM])) {
          synergyStones += 1
          if (outcomeCounts[outcome] === maxCopiesPerItem) {
            ineligibleStones += 1
          }
          if (synergyStones === 4) {
            break
          }
        }
      }
      if (i < nbItemsToPick) {
        // This doesn't perfectly replicate the original probabilities. That is, it doesn't replicate the tiny potential increase in the chance of picking an ineligible item due to picking more synergy stones that get rerolled later.
        // Furthermore, I assume the placeholder represents an eligible stone, and for maxCopiesPerItem > 1, I ignore that possibility that it would become ineligible.
        const nonStoneIds = CraftableNoStonesOrScarves.map(item => ItemInteger[item] + PRNG_N_OFFSET_CAROUSEL_ITEM)
        let eligibleStones = outcomeIds.length - nonStoneIds.length - ineligibleStones
        let placeholders = 0
        do {
          const weights = Object.fromEntries(nonStoneIds.map(id =>
            [id, outcomeCounts[id] && outcomeCounts[id] >= maxCopiesPerItem ? ineligibleWeight : eligibleWeight]))
          weights[STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER] = eligibleStones * eligibleWeight + ineligibleStones * ineligibleWeight
          const outcome = randomNeedle(nonPlayerRngState, weights)!
          i += 1
          if (outcome === STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER) {
            placeholders += 1
            if (maxCopiesPerItem === 1) {
              eligible -= 1
              const ineligible = outcomeIds.length - eligible
              ineligibleWeight = (ineligible / outcomeIds.length) ** 10
              eligibleWeight = (1 - ineligibleWeight) / eligible
              ineligibleWeight /= ineligible
              eligibleStones -= 1
              ineligibleStones += 1
            }
          } else {
            outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
            if (outcomeCounts[outcome] === maxCopiesPerItem) {
              eligible -= 1
              const ineligible = outcomeIds.length - eligible
              ineligibleWeight = (ineligible / outcomeIds.length) ** 10
              eligibleWeight = (1 - ineligibleWeight) / eligible
              ineligibleWeight /= ineligible
            }
          }
        } while (i < nbItemsToPick)
        if (placeholders) {
          const outcomes = randomNeedles(nonPlayerRngState, Object.fromEntries(nonStoneIds.map(id => [id, 1])), placeholders)
          for (const outcome of outcomes) {
            outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
          }
        }
      }
    }
    for (const [id, count] of Object.entries(outcomeCounts)) {
      const item = ItemByInteger[parseInt(id) - PRNG_N_OFFSET_CAROUSEL_ITEM]
      for (let i = 0; i < count; i++) {
        items.push(item)
      }
    }

    return shuffleArray(items)
  }

  pickRandomSynergySymbols(stageLevel: number, room: GameRoom) {
    const offset = stageLevel * PRNG_SUBOFFSET + PRNG_P_OFFSET_CAROUSEL_SYNERGY
    if (stageLevel === 0) {
      //const n_offset = PRNG_N_OFFSET_CAROUSEL_SYNERGY // currently, offset happens to be the right value when stageLevel is 0
      const weights = Object.fromEntries(Object.values(SynergyInteger).map(i => [i + offset, 1]))
      const outcomes = randomNeedles(room.state.nonPlayerRngState, weights, 3 * ((this.avatars?.size ?? 8) + 1), false)
      outcomes.forEach((needleId, i) => {
        const symbol = new SynergySymbol(this.centerX, this.centerY, SynergyByInteger[parseInt(needleId) - offset], i)
        this.symbols?.set(symbol.id, symbol)
      })
    } else {
      this.avatars?.forEach((avatar) => {
        const player = this.alivePlayers.find((p) => p.id === avatar.id)!
        const synergiesUsable = Object.values(Synergy).filter((type) => {
          if (type === Synergy.BABY && stageLevel === 20) return false // no baby legendaries
          return true
        })
        const synergiesTriggerLevels: [Synergy, number][] = Array.from(
          player.synergies
        )
          .filter(([type, value]) => synergiesUsable.includes(type))
          .map(([type, value]) => {
            let levelReached = getSynergyStep(player.synergies, type)
            // lowering down low triggers synergies
            if (type === Synergy.LIGHT) {
              levelReached = [0, 1, 1, 2, 3][levelReached]
            }
            if (type === Synergy.FLORA) {
              levelReached = [0, 1, 2, 3, 3][levelReached]
            }
            if (stageLevel === 20 && type === Synergy.GOURMET) {
              // not enough legendaries of that type
              levelReached = max(2)(levelReached)
            }
            return [type, levelReached] as [Synergy, number]
          })
          .sort(([typeA, stepA], [typeB, stepB]) => {
            const levelA = player.synergies.get(typeA) ?? 0
            const levelB = player.synergies.get(typeB) ?? 0
            if (stepA !== stepB) {
              return stepB - stepA
            } else if (levelA !== levelB) {
              return levelB - levelA
            } else {
              // favor synergies with the least distribution (should be at the end of the list)
              return SynergyArray.indexOf(typeB) - SynergyArray.indexOf(typeA)
            }
          })

        /*logger.debug(
          "Synergies sorted",
          synergiesTriggerLevels.map(([t, l]) => `${t}:${l}`).join(", ")
        )*/

        let candidatesSymbols: Synergy[] = []
        const MIN_SYMBOLS_POOL_SIZE = NB_SYMBOLS_PER_PLAYER //4 // see 2026-7-5 comment below
        const MAX_SYMBOLS_POOL_SIZE = 7
        const MAX_SYMBOLS_OF_THE_SAME_TYPE = this.alivePlayers.length
        const getNbOfType = (type: Synergy) =>
          candidatesSymbols.filter((t) => t === type).length

        synergiesTriggerLevels.forEach(([type, level]) => {
          // add as many symbols as synergy levels reached
          if (getNbOfType(type) >= MAX_SYMBOLS_OF_THE_SAME_TYPE) return
          candidatesSymbols.push(...new Array(level).fill(type))
        })
        //logger.debug("symbols from synergies", candidatesSymbols)

        // 2026-7-5 Xom: I want to generate a maximum of NB_SYMBOLS_PER_PLAYER random needles;
        // Before I made any changes, NB_SYMBOLS_PER_PLAYER and MIN_SYMBOLS_POOL_SIZE were both defined as 4;
        // I will rely on them being equal, so I've changed the latter definition to MIN_SYMBOLS_POOL_SIZE = NB_SYMBOLS_PER_PLAYER.
        if (candidatesSymbols.length < MIN_SYMBOLS_POOL_SIZE) {
          // complete with random other incomplete synergies
          const incompleteSynergies = synergiesTriggerLevels
            .filter(
              ([type, level]) =>
                level === 0 &&
                player.synergies.get(type)! > 0 &&
                getNbOfType(type) < MAX_SYMBOLS_OF_THE_SAME_TYPE
            )
            .map(([type, _level]) => type)
          const weights: WeightMap = {}
          for (const s of incompleteSynergies) {
            const needleId = SynergyInteger[s] + offset
            weights[needleId] = (weights[needleId] || 0) + 1
          }
          const outcomes = randomNeedles(player.rngState, weights, MIN_SYMBOLS_POOL_SIZE - candidatesSymbols.length, false)
          for (const needleId of outcomes) {
            candidatesSymbols.push(SynergyByInteger[parseInt(needleId) - offset])
          }
          /*logger.debug(
            "completing symbols with incomplete synergies",
            incompleteSynergies
          )*/
          if (candidatesSymbols.length < MIN_SYMBOLS_POOL_SIZE) {
            // if still incomplete, complete with random
            const weights = Object.fromEntries(synergiesUsable
              .filter(type => getNbOfType(type) < MAX_SYMBOLS_OF_THE_SAME_TYPE)
              .map(s => [SynergyInteger[s] + offset, 1]))
            do {
              const needleId = randomNeedle(player.rngState, weights)!
              const s = SynergyByInteger[parseInt(needleId) - offset]
              candidatesSymbols.push(s)
              if (getNbOfType(s) === MAX_SYMBOLS_OF_THE_SAME_TYPE) {
                delete weights[needleId]
              }
            } while (candidatesSymbols.length < MIN_SYMBOLS_POOL_SIZE)
            /*logger.debug(
              "completing symbols with random synergies",
              candidatesSymbols
            )*/
          }
          //logger.debug(`symbols chosen for player ${player.name}`, candidatesSymbols)
          shuffleArray(candidatesSymbols).forEach((type, i) => {
            const symbol = new SynergySymbol(avatar.x, avatar.y, type, i)
            this.symbols?.set(symbol.id, symbol)
          })
        } else {
          candidatesSymbols = candidatesSymbols.slice(0, MAX_SYMBOLS_POOL_SIZE)
          //logger.debug("final candidates symbols", candidatesSymbols)
          const weights: WeightMap = {}
          for (const s of candidatesSymbols) {
            const needleId = SynergyInteger[s] + offset
            weights[needleId] = (weights[needleId] || 0) + 1
          }
          const outcomes = randomNeedles(player.rngState, weights, NB_SYMBOLS_PER_PLAYER, false) // Xom: Even if this picks all of them, it randomizes the order.
          //logger.debug(`symbols chosen for player ${player.name}`, symbols)
          outcomes.forEach((needleId, i) => {
            const symbol = new SynergySymbol(avatar.x, avatar.y, SynergyByInteger[parseInt(needleId) - offset], i)
            this.symbols?.set(symbol.id, symbol)
          })
        }
      })
    }

    const portalIds = schemaKeys(this.portals!)
    const symbols = schemaValues(this.symbols!)

    // randomly distribute symbols across portals
    const symbolDeck: Record<string, SynergySymbol[]> = {}
    for (const symbol of symbols) {
      const needleId = SynergyInteger[symbol.synergy] + offset
      if (symbolDeck[needleId]) {
        symbolDeck[needleId].push(symbol)
      } else {
        symbolDeck[needleId] = [symbol]
      }
    }
    for (const needleId of Object.keys(symbolDeck)) {
      if (symbolDeck[needleId].length > 1) {
        shuffleArray(symbolDeck[needleId])
      }
    }
    const n = portalIds.length
    let remaining = symbols.length
    const buckets: SynergySymbol[][] = portalIds.map(x => []);
    const bucketSpace = portalIds.map((x, i) => Math.floor(remaining / n) + (i < (remaining % n) ? 1 : 0))
    const haystacks: Haystack[] = []
    let seedGenerator = createPcg32({}, room.state.nonPlayerRngState.seed, PRNG_N_PORTAL_SYMBOL_SEED) // PRNG_N_PORTAL_SYMBOL_SEED can be reused because offset varies by stageLevel
    for (let i = 0; i < n; i++) {
      const [seed, nextState] = pcgRandomUint64(seedGenerator)
      haystacks.push(createHaystack(seed))
      seedGenerator = nextState
    }
    while (remaining > 0) {
      const symbolDeckEntries = Object.entries(symbolDeck)
      const [haystackStr, needleId] = randomNeedleFromHaystacks(Object.fromEntries(haystacks.flatMap((haystack, i) =>
        bucketSpace[i] === 0 ? [] : [
          [i, {
            haystack,
            weights: Object.fromEntries(symbolDeckEntries.map(([needleId, a]) => [needleId, a.length * bucketSpace[i]])),
          }]
        ])))!
      const index = parseInt(haystackStr)
      buckets[index].push(symbolDeck[needleId].pop()!)
      if (symbolDeck[needleId].length === 0) {
        delete symbolDeck[needleId]
      }
      bucketSpace[index] -= 1
      remaining -= 1
    }

    shuffleArray(portalIds)
    this.symbolsByPortal = new Map()
    for (let i = 0; i < n; i++) {
      const portalId = portalIds[i]
      const bucket = buckets[i]
      this.symbolsByPortal.set(portalId, bucket)
      bucket.forEach((symbol, j) => {
        room.clock.setTimeout(
          () => {
            symbol.index = j
            symbol.portalId = portalId
          },
          1500 * ((j * n + i) / symbols.length)
        )
      })
    }

    // assign a map to each portal
    const mapOffset = stageLevel * PRNG_SUBOFFSET + PRNG_N_OFFSET_CAROUSEL_MAP
    const maps = new Set(Object.values(DungeonPMDO))
    for (let i = 0; i < n; i++) {
      bucketSpace[i] = 1
    }
    for (let i = 0; i < n; i++) {
      const haystackMap: Record<string, { haystack: Haystack; weights: WeightMap }> = {}
      for (let j = 0; j < n; j++) {
        if (bucketSpace[j] === 0) {
          continue
        }
        const portalSynergies = buckets[j].map(s => s.synergy)
        let nbMaxInCommon = 0
        let candidateMaps: DungeonPMDO[] = []
        maps.forEach(map => {
          const synergies = RegionDetails[map].synergies
          const inCommon = synergies.filter(s => portalSynergies.includes(s))
          if (inCommon.length > nbMaxInCommon) {
            nbMaxInCommon = inCommon.length
            candidateMaps = [map]
          } else if (inCommon.length === nbMaxInCommon) {
            candidateMaps.push(map)
          }
        })
        const weight = 1 / candidateMaps.length
        haystackMap[j] = {
          haystack: haystacks[j],
          weights: Object.fromEntries(candidateMaps.map(map => [DungeonInteger[map] + mapOffset, weight])),
        }
      }
      const [haystackStr, needleId] = randomNeedleFromHaystacks(haystackMap)!
      const index = parseInt(haystackStr)
      const map = DungeonByInteger[parseInt(needleId) - mapOffset]
      this.portals!.get(portalIds[index])!.map = map
      maps.delete(map) // a map can't be taken twice
      bucketSpace[index] = 0
      // console.log(map, buckets[index].map(s => s.synergy))
    }
  }

  applyVector(id: string, x: number, y: number) {
    const avatar = this.avatars?.get(id)
    if (avatar && avatar.timer <= 0) {
      avatar.targetX = avatar.x + x
      avatar.targetY = avatar.y - y
      this.updatePlayerVector(id)
    }
  }

  updatePlayerVector(id: string) {
    const avatar = this.avatars?.get(id)
    const body = this.bodies.get(id)
    if (body && avatar && avatar.timer <= 0) {
      if (!avatar.itemId) {
        body.collisionFilter.mask = 1 // activate collision if moving avatar without item
      }

      const distanceToTarget = Math.sqrt(
        (avatar.targetX - avatar.x) ** 2 + (avatar.targetY - avatar.y) ** 2
      )
      if (distanceToTarget > PLAYER_VELOCITY) {
        avatar.action = PokemonActionState.WALK
        let moveVector = Vector.sub(
          Vector.create(avatar.targetX, avatar.targetY),
          Vector.create(avatar.x, avatar.y)
        )
        avatar.orientation = getOrientation(
          0,
          0,
          moveVector.x,
          -1 * moveVector.y
        )
        moveVector = Vector.normalise(moveVector)
        moveVector = Vector.mult(moveVector, PLAYER_VELOCITY)
        Body.setVelocity(body, moveVector)
      } else {
        avatar.action = PokemonActionState.IDLE
        Body.setVelocity(body, Vector.create(0, 0))
      }
    }
  }

  stop(state: GameState) {
    const players: MapSchema<Player> = state.players
    const encounter = state.townEncounter
    this.bodies.forEach((body, key) => {
      Composite.remove(this.engine.world, body)
      this.bodies.delete(key)
    })
    this.avatars!.forEach((avatar) => {
      const player = players.get(avatar.id)
      if (
        avatar.itemId === "" &&
        player &&
        !player.isBot &&
        this.items &&
        !(
          encounter &&
          encounter in TownEncounterSellPrice &&
          state.specialGameRule !== SpecialGameRule.TOWN_FESTIVAL
        )
      ) {
        // give a random item if none was taken
        const remainingItems = [...this.items.entries()].filter(
          ([_itemId, item]) => item.avatarId === ""
        )
        if (remainingItems.length > 0) {
          avatar.itemId = pickRandomIn(remainingItems)[0]
        }
      }

      if (avatar.portalId === "") {
        // random propositions if no portal was taken
        avatar.portalId = "random"
        if (state.stageLevel === 0 && this.portals) {
          // for initial portal, force to pick one of the portals not taken
          avatar.portalId = pickRandomIn(
            schemaValues(this.portals).filter((p) => p.avatarId === "")
          ).id
        }
      }

      if (avatar.itemId) {
        const item = this.items?.get(avatar.itemId)
        if (item && player && !player.isBot) {
          if (item.name === Item.EGG_FOR_SELL) {
            giveRandomEgg(player, false)
          } else if (item.name === Item.GIMMIGHOUL_COIN) {
            player.items.push(item.name)
            player.addMoney(5, true, null)
          } else if (isIn(SynergyGems, item.name)) {
            const type = SynergyGivenByGem[item.name]
            player.bonusSynergies.set(
              type,
              (player.bonusSynergies.get(type) ?? 0) + 1
            )
            player.items.push(item.name)
            player.updateSynergies()
          } else {
            player.items.push(item.name)
          }
        }
      }

      if (player && PortalCarouselStages.includes(state.stageLevel)) {
        if (avatar.portalId && this.portals?.has(avatar.portalId)) {
          const portal = this.portals.get(avatar.portalId)!
          if (portal.map !== player.map) {
            const previousMap = player.map
            player.map = portal.map
            player.regions.push(portal.map)
            player.updateRegionalPool(state, true, previousMap)
            const newBerryTreeTypes = randomNeedles(player.rngState, Object.fromEntries(
              NonSpecialBerries.map(item => [ItemInteger[item] + PRNG_P_OFFSET_BERRY_TREE, 1])
            ), 3, false).map(needleId => ItemByInteger[parseInt(needleId) - PRNG_P_OFFSET_BERRY_TREE])
            for (let i = 0; i < player.berryTreesType.length; i++) {
              player.berryTreesType[i] = newBerryTreeTypes[i]
              player.berryTreesStages[i] = 0
            }
          }
        }

        const symbols = this.symbolsByPortal.get(avatar.portalId) ?? []
        const portalSynergies = symbols.map((s) => s.synergy)
        if (
          state.specialGameRule === SpecialGameRule.DO_IT_ALL_YOURSELF &&
          state.stageLevel === 0
        ) {
          const avatar = spawnDIAYAvatar(player)
          player.board.set(avatar.id, avatar)
          avatar.onAcquired(player)
        } else {
          state.shop.assignUniquePropositions(player, state, portalSynergies)
        }
      }

      this.avatars!.delete(avatar.id)
    })

    if (this.items) {
      this.items.forEach((item) => {
        this.items!.delete(item.id)
      })
    }

    if (this.portals) {
      this.portals.forEach((portal) => {
        this.portals!.delete(portal.id)
      })
    }

    if (this.symbols) {
      this.symbols.forEach((symbol) => {
        this.symbols!.delete(symbol.id)
      })
    }

    if (state.townEncounter === TownEncounters.WIGGLYTUFF) {
      const candidateMissions = MissionOrders.filter((m) =>
        state.shinyEncounter ? m !== Item.MISSION_ORDER_GOLD : true
      )
      this.alivePlayers.forEach((player) => {
        player.choices.push(
          new PlayerChoice({
            type: "mission_order",
            items: pickNRandomIn(candidateMissions, 3)
          })
        )
      })
    }
  }
}
