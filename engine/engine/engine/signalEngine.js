'use strict';

/*
 * Trader AI
 * Multi-Factor Signal Engine
 *
 * Combines:
 *   1. Technical indicators
 *   2. Market structure
 *   3. Momentum
 *   4. Volume
 *   5. VWAP
 *   6. Support / Resistance
 *
 * Output:
 *   BUY / SELL / WAIT
 *   score
 *   confidence
 *   reasons
 *   target1
 *   target2
 *   stopLoss
 *   invalidation
 *
 * NOTE:
 * This is a decision-support score.
 * It is NOT a guaranteed prediction of future price.
 */


function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
}


function clamp(value, min, max) {

    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}


/* =========================================================
   SCORE WEIGHTING
   ========================================================= */

var WEIGHTS = {

    trend: 20,

    momentum: 15,

    macd: 12,

    rsi: 8,

    structure: 20,

    volume: 10,

    vwap: 8,

    breakout: 7
};


/* =========================================================
   TREND SCORE
   ========================================================= */

function trendScore(indicators) {

    var score = 0;
    var reasons = [];

    if (
        indicators.ema9 !== null &&
        indicators.ema20 !== null
    ) {

        if (
            indicators.ema9 >
            indicators.ema20
        ) {

            score += 5;

            reasons.push(
                'EMA 9 is above EMA 20'
            );

        } else if (
            indicators.ema9 <
            indicators.ema20
        ) {

            score -= 5;

            reasons.push(
                'EMA 9 is below EMA 20'
            );
        }
    }


    if (
        indicators.ema20 !== null &&
        indicators.ema50 !== null
    ) {

        if (
            indicators.ema20 >
            indicators.ema50
        ) {

            score += 5;

            reasons.push(
                'EMA 20 is above EMA 50'
            );

        } else if (
            indicators.ema20 <
            indicators.ema50
        ) {

            score -= 5;

            reasons.push(
                'EMA 20 is below EMA 50'
            );
        }
    }


    if (
        indicators.ema50 !== null &&
        indicators.ema200 !== null
    ) {

        if (
            indicators.ema50 >
            indicators.ema200
        ) {

            score += 5;

            reasons.push(
                'EMA 50 is above EMA 200'
            );

        } else if (
            indicators.ema50 <
            indicators.ema200
        ) {

            score -= 5;

            reasons.push(
                'EMA 50 is below EMA 200'
            );
        }
    }


    if (
        indicators.priceVsEMA20 === 'ABOVE'
    ) {

        score += 5;

        reasons.push(
            'Price is above EMA 20'
        );

    } else if (
        indicators.priceVsEMA20 === 'BELOW'
    ) {

        score -= 5;

        reasons.push(
            'Price is below EMA 20'
        );
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.trend,
            WEIGHTS.trend
        ),
        reasons: reasons
    };
}


/* =========================================================
   MOMENTUM SCORE
   ========================================================= */

function momentumScore(indicators) {

    var score = 0;
    var reasons = [];


    if (indicators.change5 !== null) {

        if (indicators.change5 > 0.5) {

            score += 5;

            reasons.push(
                'Short-term momentum is positive'
            );

        } else if (indicators.change5 < -0.5) {

            score -= 5;

            reasons.push(
                'Short-term momentum is negative'
            );
        }
    }


    if (indicators.change20 !== null) {

        if (indicators.change20 > 1) {

            score += 5;

            reasons.push(
                'Medium-term momentum is positive'
            );

        } else if (indicators.change20 < -1) {

            score -= 5;

            reasons.push(
                'Medium-term momentum is negative'
            );
        }
    }


    if (
        indicators.stochastic14 !== null
    ) {

        if (
            indicators.stochastic14 > 55 &&
            indicators.stochastic14 < 90
        ) {

            score += 3;

            reasons.push(
                'Stochastic supports bullish momentum'
            );

        } else if (
            indicators.stochastic14 < 45 &&
            indicators.stochastic14 > 10
        ) {

            score -= 3;

            reasons.push(
                'Stochastic supports bearish momentum'
            );
        }
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.momentum,
            WEIGHTS.momentum
        ),
        reasons: reasons
    };
}


/* =========================================================
   MACD SCORE
   ========================================================= */

function macdScore(indicators) {

    var score = 0;
    var reasons = [];

    if (!indicators.macd) {

        return {
            score: 0,
            reasons: []
        };
    }


    if (
        indicators.macd.macd !== null &&
        indicators.macd.signal !== null
    ) {

        if (
            indicators.macd.macd >
            indicators.macd.signal
        ) {

            score += 7;

            reasons.push(
                'MACD is above signal'
            );

        } else if (
            indicators.macd.macd <
            indicators.macd.signal
        ) {

            score -= 7;

            reasons.push(
                'MACD is below signal'
            );
        }
    }


    if (
        indicators.macd.histogram !== null
    ) {

        if (
            indicators.macd.histogram > 0
        ) {

            score += 5;

        } else if (
            indicators.macd.histogram < 0
        ) {

            score -= 5;
        }
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.macd,
            WEIGHTS.macd
        ),
        reasons: reasons
    };
}


/* =========================================================
   RSI SCORE
   ========================================================= */

function rsiScore(indicators) {

    var score = 0;
    var reasons = [];

    var rsi =
        indicators.rsi14;


    if (rsi === null) {

        return {
            score: 0,
            reasons: []
        };
    }


    /*
     * Avoid treating extreme RSI as
     * automatically bullish/bearish.
     */

    if (
        rsi >= 50 &&
        rsi < 70
    ) {

        score += 5;

        reasons.push(
            'RSI has bullish momentum without extreme overbought conditions'
        );

    } else if (
        rsi > 30 &&
        rsi < 50
    ) {

        score -= 5;

        reasons.push(
            'RSI has bearish momentum'
        );

    } else if (
        rsi >= 70
    ) {

        /*
         * Overbought is not automatically a SELL.
         * Reduce bullish score rather than reversing it.
         */

        score += 1;

        reasons.push(
            'RSI is overbought; upside momentum is strong but stretched'
        );

    } else if (
        rsi <= 30
    ) {

        score -= 1;

        reasons.push(
            'RSI is oversold; downside momentum is strong but stretched'
        );
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.rsi,
            WEIGHTS.rsi
        ),
        reasons: reasons
    };
}


/* =========================================================
   MARKET STRUCTURE SCORE
   ========================================================= */

function structureScore(structure) {

    var score = 0;
    var reasons = [];


    if (!structure) {

        return {
            score: 0,
            reasons: []
        };
    }


    if (
        structure.trend === 'BULLISH'
    ) {

        score += 12;

        reasons.push(
            'Market structure is bullish'
        );

    } else if (
        structure.trend === 'BEARISH'
    ) {

        score -= 12;

        reasons.push(
            'Market structure is bearish'
        );
    }


    if (
        structure.latestHigh
    ) {

        if (
            structure.latestHigh.type === 'HH'
        ) {

            score += 4;

            reasons.push(
                'Latest swing high is a Higher High'
            );

        } else if (
            structure.latestHigh.type === 'LH'
        ) {

            score -= 4;

            reasons.push(
                'Latest swing high is a Lower High'
            );
        }
    }


    if (
        structure.latestLow
    ) {

        if (
            structure.latestLow.type === 'HL'
        ) {

            score += 4;

            reasons.push(
                'Latest swing low is a Higher Low'
            );

        } else if (
            structure.latestLow.type === 'LL'
        ) {

            score -= 4;

            reasons.push(
                'Latest swing low is a Lower Low'
            );
        }
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.structure,
            WEIGHTS.structure
        ),
        reasons: reasons
    };
}


/* =========================================================
   VOLUME SCORE
   ========================================================= */

function volumeScore(indicators) {

    var score = 0;
    var reasons = [];


    var ratio =
        indicators.volumeRatio20;


    if (ratio === null) {

        return {
            score: 0,
            reasons: []
        };
    }


    if (ratio >= 1.5) {

        score += 5;

        reasons.push(
            'Volume is significantly above average'
        );

    } else if (ratio >= 1.1) {

        score += 3;

        reasons.push(
            'Volume is above average'
        );
    }


    /*
     * OBV direction is useful only when
     * enough data is available.
     */

    if (
        indicators.obv !== null
    ) {

        /*
         * We do not infer direction from
         * absolute OBV alone.
         */
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.volume,
            WEIGHTS.volume
        ),
        reasons: reasons
    };
}


/* =========================================================
   VWAP SCORE
   ========================================================= */

function vwapScore(indicators) {

    var score = 0;
    var reasons = [];


    if (
        indicators.priceVsVWAP === 'ABOVE'
    ) {

        score += 8;

        reasons.push(
            'Price is above VWAP'
        );

    } else if (
        indicators.priceVsVWAP === 'BELOW'
    ) {

        score -= 8;

        reasons.push(
            'Price is below VWAP'
        );
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.vwap,
            WEIGHTS.vwap
        ),
        reasons: reasons
    };
}


/* =========================================================
   BREAKOUT SCORE
   ========================================================= */

function breakoutScore(structure) {

    var score = 0;
    var reasons = [];


    if (!structure || !structure.break) {

        return {
            score: 0,
            reasons: []
        };
    }


    if (
        structure.break.event ===
        'BREAKOUT'
    ) {

        score += 7;

        reasons.push(
            'Price has broken above a recent swing high'
        );

    } else if (
        structure.break.event ===
        'BREAKDOWN'
    ) {

        score -= 7;

        reasons.push(
            'Price has broken below a recent swing low'
        );
    }


    return {
        score: clamp(
            score,
            -WEIGHTS.breakout,
            WEIGHTS.breakout
        ),
        reasons: reasons
    };
}


/* =========================================================
   TARGET / STOP CALCULATION
   ========================================================= */

function calculateTradeLevels(
    price,
    direction,
    indicators,
    structure
) {

    var atr =
        indicators.atr14;


    /*
     * ATR fallback.
     */

    if (
        atr === null ||
        atr <= 0
    ) {

        atr =
            price * 0.01;
    }


    var stopDistance =
        atr * 1.5;


    var targetDistance1 =
        atr * 2;


    var targetDistance2 =
        atr * 3.5;


    var stopLoss;
    var target1;
    var target2;


    if (
        direction === 'BUY'
    ) {

        stopLoss =
            price - stopDistance;

        target1 =
            price + targetDistance1;

        target2 =
            price + targetDistance2;


        /*
         * If a meaningful resistance
         * exists above price, use it
         * as additional context.
         */

        if (
            structure &&
            Array.isArray(
                structure.resistance
            )
        ) {

            for (
                var i = 0;
                i < structure.resistance.length;
                i++
            ) {

                var resistance =
                    num(
                        structure.resistance[i].price
                    );

                if (
                    resistance > price
                ) {

                    target1 =
                        Math.min(
                            target1,
                            resistance
                        );

                    break;
                }
            }
        }


    } else if (
        direction === 'SELL'
    ) {

        stopLoss =
            price + stopDistance;

        target1 =
            price - targetDistance1;

        target2 =
            price - targetDistance2;


        if (
            structure &&
            Array.isArray(
                structure.support
            )
        ) {

            for (
                var j = 0;
                j < structure.support.length;
                j++
            ) {

                var support =
                    num(
                        structure.support[j].price
                    );

                if (
                    support < price
                ) {

                    target1 =
                        Math.max(
                            target1,
                            support
                        );

                    break;
                }
            }
        }


    } else {

        return {

            stopLoss: null,

            target1: null,

            target2: null
        };
    }


    return {

        stopLoss:
            Number(
                stopLoss.toFixed(4)
            ),

        target1:
            Number(
                target1.toFixed(4)
            ),

        target2:
            Number(
                target2.toFixed(4)
            )
    };
}


/* =========================================================
   FINAL SIGNAL
   ========================================================= */

function generateSignal(
    indicators,
    structure
) {

    if (
        !indicators ||
        indicators.valid === false
    ) {

        return {
            signal: 'WAIT',
            confidence: 0,
            score: 0,
            reason: 'Insufficient indicator data'
        };
    }


    var trend =
        trendScore(indicators);

    var momentum =
        momentumScore(indicators);

    var macd =
        macdScore(indicators);

    var rsi =
        rsiScore(indicators);

    var structureResult =
        structureScore(structure);

    var volume =
        volumeScore(indicators);

    var vwap =
        vwapScore(indicators);

    var breakout =
        breakoutScore(structure);


    var totalScore =
        trend.score +
        momentum.score +
        macd.score +
        rsi.score +
        structureResult.score +
        volume.score +
        vwap.score +
        breakout.score;


    /*
     * Maximum theoretical score.
     */

    var maximum =
        WEIGHTS.trend +
        WEIGHTS.momentum +
        WEIGHTS.macd +
        WEIGHTS.rsi +
        WEIGHTS.structure +
        WEIGHTS.volume +
        WEIGHTS.vwap +
        WEIGHTS.breakout;


    /*
     * Convert score to a 0-100
     * model confidence.
     */

    var normalized =
        Math.abs(totalScore) /
        maximum;


    var confidence =
        Math.round(
            clamp(
                normalized * 100,
                0,
                100
            )
        );


    var signal;


    /*
     * Require stronger confirmation
     * before issuing BUY/SELL.
     */

    if (
        totalScore >= 25
    ) {

        signal = 'BUY';

    } else if (
        totalScore <= -25
    ) {

        signal = 'SELL';

    } else {

        signal = 'WAIT';
    }


    /*
     * Reasons.
     */

    var reasons =
        trend.reasons
        .concat(momentum.reasons)
        .concat(macd.reasons)
        .concat(rsi.reasons)
        .concat(structureResult.reasons)
        .concat(volume.reasons)
        .concat(vwap.reasons)
        .concat(breakout.reasons);


    /*
     * Trade levels only for
     * actionable direction.
     */

    var levels =
        calculateTradeLevels(
            indicators.price,
            signal,
            indicators,
            structure
        );


    return {

        signal: signal,

        score:
            Number(
                totalScore.toFixed(2)
            ),

        confidence:
            confidence,

        price:
            indicators.price,

        target1:
            levels.target1,

        target2:
            levels.target2,

        stopLoss:
            levels.stopLoss,

        invalidation:
            levels.stopLoss,

        reasons:
            reasons.slice(0, 12),

        components: {

            trend:
                trend.score,

            momentum:
                momentum.score,

            macd:
                macd.score,

            rsi:
                rsi.score,

            structure:
                structureResult.score,

            volume:
                volume.score,

            vwap:
                vwap.score,

            breakout:
                breakout.score
        },

        riskModel:
            'ATR-based',

        warning:
            'Signal is probabilistic decision support, not a guaranteed prediction.'
    };
}


/* =========================================================
   COMPLETE ANALYSIS
   ========================================================= */

function analyze(
    candles,
    indicators,
    structure
) {

    if (
        !Array.isArray(candles) ||
        candles.length < 30
    ) {

        return {

            signal: 'WAIT',

            confidence: 0,

            score: 0,

            reason:
                'At least 30 candles are required'
        };
    }


    var signal =
        generateSignal(
            indicators,
            structure
        );


    return {

        valid: true,

        timestamp:
            Date.now(),

        price:
            indicators.price,

        signal:
            signal.signal,

        confidence:
            signal.confidence,

        score:
            signal.score,

        target1:
            signal.target1,

        target2:
            signal.target2,

        stopLoss:
            signal.stopLoss,

        invalidation:
            signal.invalidation,

        reasons:
            signal.reasons,

        components:
            signal.components,

        riskModel:
            signal.riskModel,

        warning:
            signal.warning
    };
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    generateSignal:
        generateSignal,

    calculateTradeLevels:
        calculateTradeLevels,

    analyze:
        analyze
};
