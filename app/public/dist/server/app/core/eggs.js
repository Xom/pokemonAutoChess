"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRandomEgg = createRandomEgg;
exports.giveRandomEgg = giveRandomEgg;
const pokemon_factory_1 = __importDefault(require("../models/pokemon-factory"));
const precomputed_pokemon_data_1 = require("../models/precomputed/precomputed-pokemon-data");
const precomputed_rarity_1 = require("../models/precomputed/precomputed-rarity");
const Game_1 = require("../types/enum/Game");
const Pokemon_1 = require("../types/enum/Pokemon");
const board_1 = require("../utils/board");
const random_1 = require("../utils/random");
const hatch_time_1 = require("./evolution-logic/hatch-time");
const shuffle_duplication_1 = require("shuffle-duplication");
function createRandomEgg(player, shiny) {
    const hatchList = precomputed_rarity_1.PRECOMPUTED_POKEMONS_PER_RARITY.HATCH.filter((p) => (0, precomputed_pokemon_data_1.getPokemonData)(p).stars === 1);
    const egg = pokemon_factory_1.default.createPokemonFromName(Pokemon_1.Pkm.EGG, { shiny });
    egg.action = Game_1.PokemonActionState.SLEEP;
    egg.stacksRequired = (0, hatch_time_1.getHatchTime)(egg, player);
    const remainingEggs = hatchList.filter((p) => !player.randomEggsGiven.includes(p));
    egg.evolution = Pokemon_1.PkmByInteger[parseInt((0, shuffle_duplication_1.randomNeedle)(player.rngState, Object.fromEntries((remainingEggs.length > 0 ? remainingEggs : hatchList).map(pkm => [Pokemon_1.PkmInteger[pkm] + random_1.PRNG_P_OFFSET_EGG, 1])))) - random_1.PRNG_P_OFFSET_EGG];
    player.randomEggsGiven.push(egg.evolution);
    return egg;
}
function giveRandomEgg(player, shiny = false) {
    const x = (0, board_1.getFirstAvailablePositionInBench)(player.board);
    if (x !== null) {
        const egg = createRandomEgg(player, shiny);
        egg.positionX = x;
        egg.positionY = 0;
        player.board.set(egg.id, egg);
        player.pokemonsPlayed.add(Pokemon_1.Pkm.EGG);
        return egg;
    }
}
//# sourceMappingURL=eggs.js.map