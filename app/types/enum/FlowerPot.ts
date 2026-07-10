export enum FlowerPot {
  PINK = "PINK",
  YELLOW = "YELLOW",
  WHITE = "WHITE",
  BLUE = "BLUE",
  ORANGE = "ORANGE"
}

export const FlowerPots = [
  FlowerPot.PINK,
  FlowerPot.YELLOW,
  FlowerPot.WHITE,
  FlowerPot.BLUE,
  FlowerPot.ORANGE
] as const

export const FlowerPotInteger: { [key in FlowerPot]: number } = Object.fromEntries(
  Object.values(FlowerPot).map((fp, i) => [fp, i + 1]) // reserve 0 to mean none
) as { [key in FlowerPot]: number };

export const FlowerPotByInteger: { [index: string]: FlowerPot } = Object.fromEntries(
  Object.entries(FlowerPotInteger).map(([fp, indexInteger]) => [indexInteger.toString(), fp as FlowerPot])
)
