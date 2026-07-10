import { Schema } from "@colyseus/schema";
import type { Item } from "../../types/enum/Item";
import type { PkmProposition } from "../../types/enum/Pokemon";
export type PlayerChoiceType = "item" | "addPick" | "starter" | "unique" | "legendary" | "mission_order" | "wand";
export declare class PlayerChoice extends Schema {
    id: string;
    type: PlayerChoiceType;
    items: Item[];
    pokemons: PkmProposition[];
    constructor(args: {
        type: PlayerChoiceType;
        items?: Item[];
        pokemons?: PkmProposition[];
    });
}
