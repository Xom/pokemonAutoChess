"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRNG_P_OFFSET_ADD = exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_VARIANT = exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION = exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_SYNERGIES = exports.PRNG_P_OFFSET_BERRY_TREE = exports.PRNG_P_OFFSET_ITEM_FREE = exports.PRNG_P_OFFSET_ITEM_PICK = exports.PRNG_P_OFFSET_EGG = exports.PRNG_P_OFFSET_CAROUSEL_SYNERGY = exports.PRNG_P_OFFSET_FLOWER_POT = exports.PRNG_P_OFFSET_BURIED_SHUFFLE = exports.PRNG_P_OFFSET_MAGNET_PULL_RARITY = exports.PRNG_P_OFFSET_FISH_RARITY = exports.PRNG_P_OFFSET_FALINKS = exports.PRNG_P_OFFSET_DITTO = exports.PRNG_P_OFFSET_SHOP_RARITY = exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_ARCEUS = exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_KECLEON = exports.PRNG_P_STARTER_EEVEE = exports.PRNG_P_CAROUSEL_POS = exports.PRNG_N_OFFSET_CAROUSEL_MAP = exports.PRNG_N_OFFSET_CAROUSEL_ITEM = exports.PRNG_N_OFFSET_CAROUSEL_SYNERGY = exports.PRNG_N_OFFSET_TOWN_ENCOUNTER = exports.PRNG_N_PVE_SHINY = exports.PRNG_N_PORTAL_SYMBOL_SEED = exports.STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE = exports.STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER = exports.PRNG_N_ENCOUNTER_MAGNEZONE_OUTLAW_STAGE = exports.PRNG_N_DEFAULT_PLAYER_SEED = exports.PRNG_SUBOFFSET = exports.pcgRandomFloat = exports.pcgRandomUint64 = void 0;
exports.chance = chance;
exports.randomWeighted = randomWeighted;
exports.randomBetween = randomBetween;
exports.pickRandomIn = pickRandomIn;
exports.pickNRandomIn = pickNRandomIn;
exports.shuffleArray = shuffleArray;
exports.simpleHashSeededCoinFlip = simpleHashSeededCoinFlip;
exports.randomUint64 = randomUint64;
exports.pcgRandomWeighted = pcgRandomWeighted;
const pcg_1 = require("pcg");
const number_1 = require("./number");
function chance(probability, pokemon, cap = 1) {
    var _a;
    if (probability === 0)
        return false;
    return (Math.random() <
        (0, number_1.max)(cap)(Math.pow(probability, 1 - ((_a = pokemon === null || pokemon === void 0 ? void 0 : pokemon.luck) !== null && _a !== void 0 ? _a : 0) / 100)));
}
function randomWeighted(weights, totalWeight, ap = 0, apScaling = 1, luck = 0) {
    if (totalWeight === undefined) {
        totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    }
    let random = Math.random() *
        totalWeight *
        (1 + ap * (apScaling / 100)) *
        (1 + luck / 100);
    for (const [item, weight] of Object.entries(weights)) {
        if ((random -= weight) < 0)
            return item;
    }
    return null;
}
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
function pickRandomIn(list) {
    if (!Array.isArray(list))
        return pickRandomIn(Object.values(list));
    return list[Math.floor(Math.random() * list.length)];
}
function pickNRandomIn(array, number) {
    const selection = [], options = [...array];
    shuffleArray(options);
    while (selection.length < number && options.length > 0) {
        selection.push(options.pop());
    }
    return selection;
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}
function simpleHashSeededCoinFlip(seed) {
    const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 2 === 0;
}
function randomUint32() {
    return randomBetween(0, number_1.TWO32);
}
function randomUint64() {
    return (0, number_1.uint64)(randomUint32(), randomUint32());
}
const pcgRandomUint32 = (0, pcg_1.randomInt)(0, number_1.TWO32);
const pcgRandomUint64 = (pcgState) => {
    const [lo, s1] = pcgRandomUint32(pcgState);
    const [hi, s2] = pcgRandomUint32(s1);
    return [(0, number_1.uint64)(hi, lo), s2];
};
exports.pcgRandomUint64 = pcgRandomUint64;
const pcgRandomFloat = (pcgState) => {
    const [value, nextState] = (0, pcg_1.randomInt)(0, number_1.TWO32, pcgState);
    return [value * number_1.INV_TWO32, nextState];
};
exports.pcgRandomFloat = pcgRandomFloat;
function pcgRandomWeighted(pcgState, weights, totalWeight, ap = 0, apScaling = 1, luck = 0) {
    if (totalWeight === undefined) {
        totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    }
    const [r, nextState] = (0, exports.pcgRandomFloat)(pcgState);
    let random = r *
        totalWeight *
        (1 + ap * (apScaling / 100)) *
        (1 + luck / 100);
    for (const [item, weight] of Object.entries(weights)) {
        if ((random -= weight) < 0)
            return [item, nextState];
    }
    return [null, nextState];
}
exports.PRNG_SUBOFFSET = 100000000;
exports.PRNG_N_DEFAULT_PLAYER_SEED = 1;
exports.PRNG_N_ENCOUNTER_MAGNEZONE_OUTLAW_STAGE = 2;
exports.STR_PRNG_N_CAROUSEL_SYNERGY_STONE_PLACEHOLDER = "3";
exports.STR_PRNG_N_CAROUSEL_EXTRA_FOSSIL_STONE = "4";
exports.PRNG_N_PORTAL_SYMBOL_SEED = 5;
exports.PRNG_N_PVE_SHINY = 6;
exports.PRNG_N_OFFSET_TOWN_ENCOUNTER = 0;
exports.PRNG_N_OFFSET_CAROUSEL_SYNERGY = 2000000000000;
exports.PRNG_N_OFFSET_CAROUSEL_ITEM = 3000000000000;
exports.PRNG_N_OFFSET_CAROUSEL_MAP = 4000000000000;
exports.PRNG_P_CAROUSEL_POS = 1;
exports.PRNG_P_STARTER_EEVEE = 2;
exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_KECLEON = 3;
exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_ARCEUS = 4;
exports.PRNG_P_OFFSET_SHOP_RARITY = 5;
exports.PRNG_P_OFFSET_DITTO = 6;
exports.PRNG_P_OFFSET_FALINKS = 7;
exports.PRNG_P_OFFSET_FISH_RARITY = 8;
exports.PRNG_P_OFFSET_MAGNET_PULL_RARITY = 9;
exports.PRNG_P_OFFSET_BURIED_SHUFFLE = 100000000;
exports.PRNG_P_OFFSET_FLOWER_POT = 200000000;
exports.PRNG_P_OFFSET_CAROUSEL_SYNERGY = 2000000000000;
exports.PRNG_P_OFFSET_EGG = 2000000000000;
exports.PRNG_P_OFFSET_ITEM_PICK = 4000000000000;
exports.PRNG_P_OFFSET_ITEM_FREE = 5000000000000;
exports.PRNG_P_OFFSET_BERRY_TREE = 6000000000000;
exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_SYNERGIES = 7000000000000;
exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION = 7000000000000;
exports.PRNG_P_OFFSET_UNIQUE_PROPOSITION_VARIANT = 8000000000000;
exports.PRNG_P_OFFSET_ADD = 9000000000000;
//# sourceMappingURL=random.js.map