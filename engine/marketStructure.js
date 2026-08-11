'use strict';

/*
 * Trader AI
 * Market Structure Engine
 *
 * Detects:
 * - Swing highs / lows
 * - Higher High (HH)
 * - Higher Low (HL)
 * - Lower High (LH)
 * - Lower Low (LL)
 * - Support / Resistance
 * - Breakout / Breakdown
 * - Market structure trend
 * - Recent range
 */

function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
}


/* =========================================================
   SWING DETECTION
   ========================================================= */

function findSwingPoints(candles, strength) {

    strength = strength || 3;

    var highs = [];
    var lows = [];

    if (!Array.isArray(candles) ||
        candles.length < (strength * 2 + 1)) {

        return {
            highs: highs,
            lows: lows
        };
    }

    for (
        var i = strength;
        i < candles.length - strength;
        i++
    ) {

        var currentHigh =
            num(candles[i].high);

        var currentLow =
            num(candles[i].low);

        var isSwingHigh = true;
        var isSwingLow = true;


        for (
            var left = i - strength;
            left <= i + strength;
            left++
        ) {

            if (left === i) {
                continue;
            }

            if (
                num(candles[left].high)
                >= currentHigh
            ) {

                isSwingHigh = false;
            }

            if (
                num(candles[left].low)
                <= currentLow
            ) {

                isSwingLow = false;
            }
        }


        if (isSwingHigh) {

            highs.push({
                index: i,
                time: candles[i].time,
                price: currentHigh
            });
        }


        if (isSwingLow) {

            lows.push({
                index: i,
                time: candles[i].time,
                price: currentLow
            });
        }
    }


    return {
        highs: highs,
        lows: lows
    };
}


/* =========================================================
   STRUCTURE CLASSIFICATION
   ========================================================= */

function classifyHighs(swingHighs) {

    var result = [];

    for (
        var i = 1;
        i < swingHighs.length;
        i++
    ) {

        var previous =
            swingHighs[i - 1];

        var current =
            swingHighs[i];

        var type;

        if (
            current.price >
            previous.price
        ) {

            type = 'HH';

        } else if (
            current.price <
            previous.price
        ) {

            type = 'LH';

        } else {

            type = 'EQUAL';
        }


        result.push({

            index: current.index,

            time: current.time,

            price: current.price,

            type: type,

            previousPrice:
                previous.price
        });
    }

    return result;
}


function classifyLows(swingLows) {

    var result = [];

    for (
        var i = 1;
        i < swingLows.length;
        i++
    ) {

        var previous =
            swingLows[i - 1];

        var current =
            swingLows[i];

        var type;

        if (
            current.price >
            previous.price
        ) {

            type = 'HL';

        } else if (
            current.price <
            previous.price
        ) {

            type = 'LL';

        } else {

            type = 'EQUAL';
        }


        result.push({

            index: current.index,

            time: current.time,

            price: current.price,

            type: type,

            previousPrice:
                previous.price
        });
    }

    return result;
}


/* =========================================================
   TREND FROM STRUCTURE
   ========================================================= */

function determineTrend(highStructures, lowStructures) {

    var recentHigh =
        highStructures.length > 0
            ? highStructures[
                highStructures.length - 1
              ]
            : null;

    var previousHigh =
        highStructures.length > 1
            ? highStructures[
                highStructures.length - 2
              ]
            : null;


    var recentLow =
        lowStructures.length > 0
            ? lowStructures[
                lowStructures.length - 1
              ]
            : null;

    var previousLow =
        lowStructures.length > 1
            ? lowStructures[
                lowStructures.length - 2
              ]
            : null;


    var bullishScore = 0;
    var bearishScore = 0;


    if (recentHigh) {

        if (recentHigh.type === 'HH') {
            bullishScore++;
        }

        if (recentHigh.type === 'LH') {
            bearishScore++;
        }
    }


    if (recentLow) {

        if (recentLow.type === 'HL') {
            bullishScore++;
        }

        if (recentLow.type === 'LL') {
            bearishScore++;
        }
    }


    /*
     * Additional confirmation from
     * consecutive structure.
     */

    if (
        previousHigh &&
        recentHigh &&
        previousLow &&
        recentLow
    ) {

        if (
            recentHigh.type === 'HH' &&
            recentLow.type === 'HL'
        ) {

            bullishScore += 2;
        }


        if (
            recentHigh.type === 'LH' &&
            recentLow.type === 'LL'
        ) {

            bearishScore += 2;
        }
    }


    if (bullishScore >= bearishScore + 2) {

        return 'BULLISH';

    } else if (bearishScore >= bullishScore + 2) {

        return 'BEARISH';

    } else {

        return 'SIDEWAYS';
    }
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function findLevels(
    candles,
    swingPoints,
    tolerancePercent
) {

    tolerancePercent =
        tolerancePercent || 0.35;


    var supports = [];
    var resistances = [];


    if (!Array.isArray(candles) ||
        candles.length === 0) {

        return {
            supports: supports,
            resistances: resistances
        };
    }


    var currentPrice =
        num(
            candles[
                candles.length - 1
            ].close
        );


    var tolerance =
        currentPrice *
        (tolerancePercent / 100);


    /*
     * Swing lows -> support
     */

    for (
        var i = 0;
        i < swingPoints.lows.length;
        i++
    ) {

        var low =
            swingPoints.lows[i];

        if (
            Math.abs(
                currentPrice - low.price
            ) <= tolerance * 8
        ) {

            supports.push({
                price: low.price,
                index: low.index,
                time: low.time
            });
        }
    }


    /*
     * Swing highs -> resistance
     */

    for (
        var j = 0;
        j < swingPoints.highs.length;
        j++
    ) {

        var high =
            swingPoints.highs[j];

        if (
            Math.abs(
                currentPrice - high.price
            ) <= tolerance * 8
        ) {

            resistances.push({
                price: high.price,
                index: high.index,
                time: high.time
            });
        }
    }


    /*
     * Sort support closest to price.
     */

    supports.sort(
        function (a, b) {

            return Math.abs(
                currentPrice - a.price
            ) -
            Math.abs(
                currentPrice - b.price
            );
        }
    );


    /*
     * Sort resistance closest to price.
     */

    resistances.sort(
        function (a, b) {

            return Math.abs(
                currentPrice - a.price
            ) -
            Math.abs(
                currentPrice - b.price
            );
        }
    );


    return {
        supports: supports,
        resistances: resistances
    };
}


/* =========================================================
   BREAKOUT / BREAKDOWN
   ========================================================= */

function detectBreak(candles, swingPoints) {

    if (!Array.isArray(candles) ||
        candles.length === 0) {

        return {
            event: 'NONE'
        };
    }


    var current =
        candles[
            candles.length - 1
        ];

    var previous =
        candles.length > 1
            ? candles[
                candles.length - 2
              ]
            : null;


    var close =
        num(current.close);


    var previousClose =
        previous
            ? num(previous.close)
            : close;


    var latestHigh =
        swingPoints.highs.length > 0
            ? swingPoints.highs[
                swingPoints.highs.length - 1
              ].price
            : null;


    var latestLow =
        swingPoints.lows.length > 0
            ? swingPoints.lows[
                swingPoints.lows.length - 1
              ].price
            : null;


    if (
        latestHigh !== null &&
        close > latestHigh &&
        previousClose <= latestHigh
    ) {

        return {

            event: 'BREAKOUT',

            level: latestHigh,

            price: close
        };
    }


    if (
        latestLow !== null &&
        close < latestLow &&
        previousClose >= latestLow
    ) {

        return {

            event: 'BREAKDOWN',

            level: latestLow,

            price: close
        };
    }


    return {
        event: 'NONE',
        price: close
    };
}


/* =========================================================
   RANGE
   ========================================================= */

function calculateRange(candles, period) {

    if (!Array.isArray(candles) ||
        candles.length < period) {

        return null;
    }


    var recent =
        candles.slice(
            candles.length - period
        );


    var highest =
        -Infinity;

    var lowest =
        Infinity;


    for (
        var i = 0;
        i < recent.length;
        i++
    ) {

        var high =
            num(recent[i].high);

        var low =
            num(recent[i].low);


        if (high > highest) {
            highest = high;
        }

        if (low < lowest) {
            lowest = low;
        }
    }


    var range =
        highest - lowest;


    var current =
        num(
            candles[
                candles.length - 1
            ].close
        );


    var position =
        range === 0
            ? 50
            : (
                (current - lowest) /
                range
            ) * 100;


    return {

        high: highest,

        low: lowest,

        range: range,

        positionPercent: position
    };
}


/* =========================================================
   COMPLETE MARKET STRUCTURE ANALYSIS
   ========================================================= */

function analyze(candles, options) {

    options =
        options || {};


    var strength =
        options.swingStrength || 3;


    var swingPoints =
        findSwingPoints(
            candles,
            strength
        );


    var highStructures =
        classifyHighs(
            swingPoints.highs
        );


    var lowStructures =
        classifyLows(
            swingPoints.lows
        );


    var trend =
        determineTrend(
            highStructures,
            lowStructures
        );


    var levels =
        findLevels(
            candles,
            swingPoints,
            options.tolerancePercent || 0.35
        );


    var breakEvent =
        detectBreak(
            candles,
            swingPoints
        );


    var range =
        calculateRange(
            candles,
            options.rangePeriod || 50
        );


    var latestHigh =
        highStructures.length > 0
            ? highStructures[
                highStructures.length - 1
              ]
            : null;


    var latestLow =
        lowStructures.length > 0
            ? lowStructures[
                lowStructures.length - 1
              ]
            : null;


    return {

        valid: true,

        trend: trend,

        swingHighs:
            swingPoints.highs,

        swingLows:
            swingPoints.lows,

        highStructure:
            highStructures,

        lowStructure:
            lowStructures,

        latestHigh:
            latestHigh,

        latestLow:
            latestLow,

        support:
            levels.supports,

        resistance:
            levels.resistances,

        break:
            breakEvent,

        range:
            range
    };
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    findSwingPoints:
        findSwingPoints,

    classifyHighs:
        classifyHighs,

    classifyLows:
        classifyLows,

    determineTrend:
        determineTrend,

    findLevels:
        findLevels,

    detectBreak:
        detectBreak,

    calculateRange:
        calculateRange,

    analyze:
        analyze
};
