"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowerPotByInteger = exports.FlowerPotInteger = exports.FlowerPots = exports.FlowerPot = void 0;
var FlowerPot;
(function (FlowerPot) {
    FlowerPot["PINK"] = "PINK";
    FlowerPot["YELLOW"] = "YELLOW";
    FlowerPot["WHITE"] = "WHITE";
    FlowerPot["BLUE"] = "BLUE";
    FlowerPot["ORANGE"] = "ORANGE";
})(FlowerPot || (exports.FlowerPot = FlowerPot = {}));
exports.FlowerPots = [
    FlowerPot.PINK,
    FlowerPot.YELLOW,
    FlowerPot.WHITE,
    FlowerPot.BLUE,
    FlowerPot.ORANGE
];
exports.FlowerPotInteger = Object.fromEntries(Object.values(FlowerPot).map((fp, i) => [fp, i + 1]));
exports.FlowerPotByInteger = Object.fromEntries(Object.entries(exports.FlowerPotInteger).map(([fp, indexInteger]) => [indexInteger.toString(), fp]));
//# sourceMappingURL=FlowerPot.js.map