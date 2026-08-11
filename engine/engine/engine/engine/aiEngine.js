'use strict';

/*
 * Trader AI
 * AI Decision / Fusion Engine
 *
 * Purpose:
 * Combine:
 *   - Technical indicators
 *   - Market structure
 *   - Signal engine
 *   - Multi-timeframe analysis
 *   - Volatility
 *   - Signal agreement
 *
 * Output:
 *   - BUY / SELL / WAIT
 *   - confidence
 *   - market regime
 *   - direction strength
 *   - target quality
 *   - risk quality
 *   - explanation
 *
 * IMPORTANT:
 * This is an analytical scoring layer.
 * It does NOT guarantee future price movement.
 */


/* =========================================================
   HELPERS
   ========================================================= */

function num(value) {

    var n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
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


function round(value, digits) {

    var multiplier =
        Math.pow(10, digits || 2);

    return Math.round(
        value * multiplier
    ) / multiplier;
}


/* =========================================================
   MARKET REGIME
   ========================================================= */

function detectRegime(
    indicators,
    structure
) {

    var trendScore = 0;
    var volatilityScore = 0;


    if (indicators) {

        if (
            indicators.ema20 !== null &&
            indicators.ema50 !== null
        ) {

            if (
                indicators.ema20 >
                indicators.ema50
            ) {

                trendScore += 2;

            } else if (
                indicators.ema20 <
                indicators.ema50
            ) {

                trendScore -= 2;
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

                trendScore += 2;

            } else if (
                indicators.ema50 <
                indicators.ema200
            ) {

                trendScore -= 2;
            }
        }


        /*
         * ATR relative to price.
         */

        if (
            indicators.atr14 !== null &&
            indicators.price > 0
        ) {

            var atrPercent =
                (
                    indicators.atr14 /
                    indicators.price
                ) * 100;


            if (atrPercent >= 3) {

                volatilityScore = 2;

            } else if (atrPercent >= 1.5) {

                volatilityScore = 1;

            } else {

                volatilityScore = 0;
            }
        }
    }


    if (structure) {

        if (
            structure.trend ===
            'BULLISH'
        ) {

            trendScore += 2;

        } else if (
            structure.trend ===
            'BEARISH'
        ) {

            trendScore -= 2;
        }
    }


    var trend;


    if (trendScore >= 4) {

        trend = 'STRONG_BULLISH';

    } else if (trendScore >= 2) {

        trend = 'BULLISH';

    } else if (trendScore <= -4) {

        trend = 'STRONG_BEARISH';

    } else if (trendScore <= -2) {

        trend = 'BEARISH';

    } else {

        trend = 'SIDEWAYS';
    }


    var volatility;

    if (volatilityScore >= 2) {

        volatility = 'HIGH';

    } else if (volatilityScore === 1) {

        volatility = 'MEDIUM';

    } else {

        volatility = 'LOW';
    }


    return {

        trend: trend,

        volatility: volatility,

        trendScore: trendScore
    };
}


/* =========================================================
   MULTI-TIMEFRAME AGREEMENT
   ========================================================= */

function timeframeDirection(analysis) {

    if (!analysis) {
        return 'NEUTRAL';
    }


    if (
        analysis.signal === 'BUY'
    ) {

        return 'BULLISH';
    }


    if (
        analysis.signal === 'SELL'
    ) {

        return 'BEARISH';
    }


    return 'NEUTRAL';
}


function calculateTimeframeAgreement(
    timeframeAnalyses
) {

    if (
        !timeframeAnalyses ||
        typeof timeframeAnalyses !== 'object'
    ) {

        return {

            direction: 'NEUTRAL',

            agreement: 0,

            bullish: 0,

            bearish: 0,

            neutral: 0
        };
    }


    var bullish = 0;
    var bearish = 0;
    var neutral = 0;


    var keys =
        Object.keys(
            timeframeAnalyses
        );


    for (
        var i = 0;
        i < keys.length;
        i++
    ) {

        var analysis =
            timeframeAnalyses[
                keys[i]
            ];


        var direction =
            timeframeDirection(
                analysis
            );


        if (
            direction ===
            'BULLISH'
        ) {

            bullish++;

        } else if (
            direction ===
            'BEARISH'
        ) {

            bearish++;

        } else {

            neutral++;
        }
    }


    var total =
        bullish +
        bearish +
        neutral;


    if (total === 0) {

        return {

            direction: 'NEUTRAL',

            agreement: 0,

            bullish: 0,

            bearish: 0,

            neutral: 0
        };
    }


    var dominant =
        Math.max(
            bullish,
            bearish
        );


    var agreement =
        Math.round(
            (
                dominant /
                total
            ) * 100
        );


    var direction = 'NEUTRAL';


    if (
        bullish > bearish &&
        bullish > neutral
    ) {

        direction = 'BULLISH';

    } else if (
        bearish > bullish &&
        bearish > neutral
    ) {

        direction = 'BEARISH';
    }


    return {

        direction: direction,

        agreement: agreement,

        bullish: bullish,

        bearish: bearish,

        neutral: neutral
    };
}


/* =========================================================
   SIGNAL QUALITY
   ========================================================= */

function calculateSignalQuality(
    signal,
    regime,
    timeframe
) {

    if (!signal) {

        return {
            quality: 0,
            reasons: []
        };
    }


    var quality = 0;
    var reasons = [];


    /*
     * Base quality from model score.
     */

    quality +=
        clamp(
            num(signal.confidence) *
            0.35,
            0,
            35
        );


    /*
     * Market regime agreement.
     */

    if (
        signal.signal === 'BUY'
    ) {

        if (
            regime.trend ===
                'BULLISH' ||
            regime.trend ===
                'STRONG_BULLISH'
        ) {

            quality += 20;

            reasons.push(
                'Signal agrees with bullish market regime'
            );
        }


        if (
            regime.trend ===
                'BEARISH' ||
            regime.trend ===
                'STRONG_BEARISH'
        ) {

            quality -= 20;

            reasons.push(
                'Signal conflicts with bearish market regime'
            );
        }
    }


    if (
        signal.signal === 'SELL'
    ) {

        if (
            regime.trend ===
                'BEARISH' ||
            regime.trend ===
                'STRONG_BEARISH'
        ) {

            quality += 20;

            reasons.push(
                'Signal agrees with bearish market regime'
            );
        }


        if (
            regime.trend ===
                'BULLISH' ||
            regime.trend ===
                'STRONG_BULLISH'
        ) {

            quality -= 20;

            reasons.push(
                'Signal conflicts with bullish market regime'
            );
        }
    }


    /*
     * Multi-timeframe agreement.
     */

    if (
        timeframe.direction ===
        'BULLISH' &&
        signal.signal === 'BUY'
    ) {

        quality +=
            timeframe.agreement * 0.25;

        reasons.push(
            'Higher timeframe direction supports BUY'
        );
    }


    if (
        timeframe.direction ===
        'BEARISH' &&
        signal.signal === 'SELL'
    ) {

        quality +=
            timeframe.agreement * 0.25;

        reasons.push(
            'Higher timeframe direction supports SELL'
        );
    }


    if (
        timeframe.direction ===
            'BULLISH' &&
        signal.signal === 'SELL'
    ) {

        quality -=
            timeframe.agreement * 0.25;

        reasons.push(
            'Timeframes disagree with SELL'
        );
    }


    if (
        timeframe.direction ===
            'BEARISH' &&
        signal.signal === 'BUY'
    ) {

        quality -=
            timeframe.agreement * 0.25;

        reasons.push(
            'Timeframes disagree with BUY'
        );
    }


    return {

        quality:
            Math.round(
                clamp(
                    quality,
                    0,
                    100
                )
            ),

        reasons: reasons
    };
}


/* =========================================================
   TARGET QUALITY
   ========================================================= */

function targetQuality(
    signal
) {

    if (!signal) {
        return 0;
    }


    if (
        signal.signal === 'WAIT'
    ) {

        return 0;
    }


    var entry =
        num(signal.price);

    var target =
        num(signal.target1);

    var stop =
        num(signal.stopLoss);


    if (
        entry <= 0 ||
        target <= 0 ||
        stop <= 0
    ) {

        return 0;
    }


    var reward =
        Math.abs(
            target - entry
        );


    var risk =
        Math.abs(
            entry - stop
        );


    if (risk === 0) {
        return 0;
    }


    var rr =
        reward / risk;


    /*
     * Score target quality.
     */

    var quality = 0;


    if (rr >= 2) {

        quality = 100;

    } else if (rr >= 1.5) {

        quality = 80;

    } else if (rr >= 1) {

        quality = 55;

    } else {

        quality = 25;
    }


    return {

        rr: round(rr, 2),

        quality: quality
    };
}


/* =========================================================
   CONFLICT DETECTION
   ========================================================= */

function detectConflict(
    signal,
    regime,
    timeframe
) {

    var conflicts = [];


    if (!signal) {
        return conflicts;
    }


    if (
        signal.signal === 'BUY' &&
        (
            regime.trend ===
                'STRONG_BEARISH'
        )
    ) {

        conflicts.push(
            'BUY conflicts with strong bearish regime'
        );
    }


    if (
        signal.signal === 'SELL' &&
        (
            regime.trend ===
                'STRONG_BULLISH'
        )
    ) {

        conflicts.push(
            'SELL conflicts with strong bullish regime'
        );
    }


    if (
        signal.signal === 'BUY' &&
        timeframe.direction ===
            'BEARISH' &&
        timeframe.agreement >= 67
    ) {

        conflicts.push(
            'Majority of timeframes are bearish'
        );
    }


    if (
        signal.signal === 'SELL' &&
        timeframe.direction ===
            'BULLISH' &&
        timeframe.agreement >= 67
    ) {

        conflicts.push(
            'Majority of timeframes are bullish'
        );
    }


    return conflicts;
}


/* =========================================================
   FINAL DECISION
   ========================================================= */

function decide(
    signal,
    indicators,
    structure,
    timeframeAnalyses
) {

    if (!signal) {

        return {

            decision: 'WAIT',

            confidence: 0,

            reason:
                'No signal engine result'
        };
    }


    var regime =
        detectRegime(
            indicators,
            structure
        );


    var timeframe =
        calculateTimeframeAgreement(
            timeframeAnalyses
        );


    var quality =
        calculateSignalQuality(
            signal,
            regime,
            timeframe
        );


    var target =
        targetQuality(
            signal
        );


    var conflicts =
        detectConflict(
            signal,
            regime,
            timeframe
        );


    /*
     * Final confidence combines:
     *
     * Signal quality 50%
     * Target quality 20%
     * Timeframe agreement 20%
     * Regime quality 10%
     */

    var regimeQuality = 50;


    if (
        signal.signal !== 'WAIT'
    ) {

        if (
            signal.signal === 'BUY' &&
            (
                regime.trend === 'BULLISH' ||
                regime.trend === 'STRONG_BULLISH'
            )
        ) {

            regimeQuality = 100;

        } else if (
            signal.signal === 'SELL' &&
            (
                regime.trend === 'BEARISH' ||
                regime.trend === 'STRONG_BEARISH'
            )
        ) {

            regimeQuality = 100;

        } else {

            regimeQuality = 25;
        }
    }


    var finalConfidence =
        (
            quality.quality * 0.50
        ) +
        (
            target.quality * 0.20
        ) +
        (
            timeframe.agreement * 0.20
        ) +
        (
            regimeQuality * 0.10
        );


    finalConfidence =
        Math.round(
            clamp(
                finalConfidence,
                0,
                100
            )
        );


    /*
     * Safety rule:
     *
     * If major evidence conflicts,
     * downgrade to WAIT.
     */

    var finalDecision =
        signal.signal;


    if (
        conflicts.length >= 2
    ) {

        finalDecision = 'WAIT';

        finalConfidence =
            Math.min(
                finalConfidence,
                55
            );
    }


    /*
     * Low confidence should not become
     * an aggressive actionable signal.
     */

    if (
        finalConfidence < 50
    ) {

        finalDecision = 'WAIT';
    }


    var explanation = [];


    explanation.push(
        'Market regime: ' +
        regime.trend
    );


    explanation.push(
        'Volatility: ' +
        regime.volatility
    );


    explanation.push(
        'Technical signal: ' +
        signal.signal
    );


    explanation.push(
        'Technical score: ' +
        signal.score
    );


    if (
        timeframe.agreement > 0
    ) {

        explanation.push(
            'Timeframe agreement: ' +
            timeframe.agreement +
            '%'
        );
    }


    if (
        target.rr !== undefined
    ) {

        explanation.push(
            'Risk/reward estimate: 1:' +
            target.rr
        );
    }


    for (
        var i = 0;
        i < conflicts.length;
        i++
    ) {

        explanation.push(
            'CONFLICT: ' +
            conflicts[i]
        );
    }


    return {

        decision:
            finalDecision,

        confidence:
            finalConfidence,

        technicalSignal:
            signal.signal,

        technicalScore:
            signal.score,

        marketRegime:
            regime.trend,

        volatility:
            regime.volatility,

        timeframeAgreement:
            timeframe.agreement,

        timeframeDirection:
            timeframe.direction,

        targetQuality:
            target.quality,

        riskReward:
            target.rr !== undefined
                ? target.rr
                : null,

        target1:
            signal.target1,

        target2:
            signal.target2,

        stopLoss:
            signal.stopLoss,

        invalidation:
            signal.invalidation,

        conflicts:
            conflicts,

        reasons:
            signal.reasons,

        explanation:
            explanation,

        model:
            'Trader-AI-Multi-Factor-v1',

        warning:
            'This output is probabilistic decision support, not a guaranteed market prediction.'
    };
}


/* =========================================================
   COMPLETE AI ANALYSIS
   ========================================================= */

function analyze(
    signal,
    indicators,
    structure,
    timeframeAnalyses
) {

    return decide(
        signal,
        indicators,
        structure,
        timeframeAnalyses
    );
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    detectRegime:
        detectRegime,

    calculateTimeframeAgreement:
        calculateTimeframeAgreement,

    calculateSignalQuality:
        calculateSignalQuality,

    targetQuality:
        targetQuality,

    detectConflict:
        detectConflict,

    decide:
        decide,

    analyze:
        analyze
};
