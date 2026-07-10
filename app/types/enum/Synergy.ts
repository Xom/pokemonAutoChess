export enum Synergy {
  NORMAL = "NORMAL",
  FLYING = "FLYING",
  FIELD = "FIELD",
  DARK = "DARK",
  GROUND = "GROUND",
  PSYCHIC = "PSYCHIC",
  GRASS = "GRASS",
  BUG = "BUG",
  WATER = "WATER",
  AQUATIC = "AQUATIC",
  POISON = "POISON",
  FAIRY = "FAIRY",
  FIGHTING = "FIGHTING",
  FIRE = "FIRE",
  GHOST = "GHOST",
  ROCK = "ROCK",
  MONSTER = "MONSTER",
  AMORPHOUS = "AMORPHOUS",
  WILD = "WILD",
  SOUND = "SOUND",
  FLORA = "FLORA",
  STEEL = "STEEL",
  ELECTRIC = "ELECTRIC",
  ICE = "ICE",
  BABY = "BABY",
  HUMAN = "HUMAN",
  DRAGON = "DRAGON",
  LIGHT = "LIGHT",
  GOURMET = "GOURMET",
  FOSSIL = "FOSSIL",
  ARTIFICIAL = "ARTIFICIAL"
}

export const SynergyArray = Object.values(Synergy)

export const SynergyInteger: { [key in Synergy]: number } = Object.fromEntries(
  Object.values(Synergy).map((s, i) => [s, i + 1]) // reserve 0 to mean none
) as { [key in Synergy]: number };

export const SynergyByInteger: { [index: string]: Synergy } = Object.fromEntries(
  Object.entries(SynergyInteger).map(([s, indexInteger]) => [indexInteger.toString(), s as Synergy])
)
