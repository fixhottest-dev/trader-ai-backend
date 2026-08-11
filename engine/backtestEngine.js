'use strict';

/*
 * Trader AI
 * Historical Backtesting Engine
 *
 * Purpose:
 * Test the trading decision engine against
 * historical OHLCV candles.
 *
 * IMPORTANT:
 * Backtesting is not proof of future profitability.
 * It is used to measure historical behaviour,
 * detect weak signals and calibrate confidence.
 */


/* =========================================================
   HELPERS
   ========================================================= */

function num(value) {

    var n = Number(value);

    return Number.isFinite(n) ? n : 0;
}


function round(value, digits) {

    var m = Math.pow(10, digits || 2);

    return Math.round(value * m) / m;
}


function clamp(value, min, max) {

    if (value < min) return min;
    if (value > max) return max;

    return value;
}


/* =========================================================
   SINGLE TRADE SIMULATION
   ========================================================= */

function simulateTrade(
    candles,
    entryIndex,
    signal
) {

    if (
        !candles ||
        entryIndex < 0 ||
        entryIndex >= candles.length ||
        !signal
    ) {

        return {
            result: 'INVALID',
            pnl: 0,
            barsHeld: 0
        };
    }


    var entry =
        num(
            signal.price ||
            candles[entryIndex].close
        );


    var stop =
        num(signal.stopLoss);


    var target =
        num(signal.target1);


    if (
        entry <= 0 ||
        stop <= 0 ||
        target <= 0
    ) {

        return {
            result: 'INVALID',
            pnl: 0,
            barsHeld: 0
        };
    }


    var direction =
        signal.signal;


    if (
        direction !== 'BUY' &&
        direction !== 'SELL'
    ) {

        return {
            result: 'WAIT',
            pnl: 0,
            barsHeld: 0
        };
    }


    /*
     * Start checking candles AFTER
     * the signal candle.
     */

    for (
        var i = entryIndex + 1;
        i < candles.length;
        i++
    ) {

        var candle =
            candles[i];


        var high =
            num(candle.high);


        var low =
            num(candle.low);


        /*
         * BUY
         */

        if (direction === 'BUY') {

            /*
             * Conservative rule:
             * if both target and stop are touched
             * inside the same candle, assume STOP
             * happened first.
             *
             * This avoids artificially inflating
             * backtest performance.
             */

            if (
                low <= stop &&
                high >= target
            ) {

                return {

                    result: 'LOSS',

                    pnl:
                        round(
                            stop - entry,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: stop,

                    exitIndex: i,

                    reason:
                        'Both target and stop touched; conservative STOP assumption'
                };
            }


            if (
                low <= stop
            ) {

                return {

                    result: 'LOSS',

                    pnl:
                        round(
                            stop - entry,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: stop,

                    exitIndex: i,

                    reason:
                        'Stop loss hit'
                };
            }


            if (
                high >= target
            ) {

                return {

                    result: 'WIN',

                    pnl:
                        round(
                            target - entry,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: target,

                    exitIndex: i,

                    reason:
                        'Target hit'
                };
            }
        }


        /*
         * SELL
         */

        if (direction === 'SELL') {

            /*
             * Same conservative rule.
             */

            if (
                high >= stop &&
                low <= target
            ) {

                return {

                    result: 'LOSS',

                    pnl:
                        round(
                            entry - stop,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: stop,

                    exitIndex: i,

                    reason:
                        'Both target and stop touched; conservative STOP assumption'
                };
            }


            if (
                high >= stop
            ) {

                return {

                    result: 'LOSS',

                    pnl:
                        round(
                            entry - stop,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: stop,

                    exitIndex: i,

                    reason:
                        'Stop loss hit'
                };
            }


            if (
                low <= target
            ) {

                return {

                    result: 'WIN',

                    pnl:
                        round(
                            entry - target,
                            4
                        ),

                    barsHeld:
                        i - entryIndex,

                    entry: entry,

                    exit: target,

                    exitIndex: i,

                    reason:
                        'Target hit'
                };
            }
        }
    }


    /*
     * Neither target nor stop was reached
     * before the historical dataset ended.
     */

    var finalPrice =
        num(
            candles[
                candles.length - 1
            ].close
        );


    var pnl = 0;


    if (direction === 'BUY') {

        pnl =
            finalPrice - entry;

    } else {

        pnl =
            entry - finalPrice;
    }


    return {

        result:
            pnl >= 0
                ? 'OPEN_PROFIT'
                : 'OPEN_LOSS',

        pnl:
            round(
                pnl,
                4
            ),

        barsHeld:
            candles.length -
            1 -
            entryIndex,

        entry:
            entry,

        exit:
            finalPrice,

        exitIndex:
            candles.length - 1,

        reason:
            'Dataset ended before target/stop'
    };
}


/* =========================================================
   PERFORMANCE METRICS
   ========================================================= */

function calculateMetrics(
    trades
) {

    var total = trades.length;

    var wins = 0;
    var losses = 0;
    var openProfit = 0;
    var openLoss = 0;

    var grossProfit = 0;
    var grossLoss = 0;

    var netPnl = 0;


    for (
        var i = 0;
        i < trades.length;
        i++
    ) {

        var trade =
            trades[i];


        var pnl =
            num(trade.pnl);


        netPnl += pnl;


        if (
            trade.result === 'WIN'
        ) {

            wins++;

            grossProfit +=
                Math.max(
                    pnl,
                    0
                );

        } else if (
            trade.result === 'LOSS'
        ) {

            losses++;

            grossLoss +=
                Math.abs(
                    Math.min(
                        pnl,
                        0
                    )
                );

        } else if (
            trade.result ===
            'OPEN_PROFIT'
        ) {

            openProfit++;

        } else if (
            trade.result ===
            'OPEN_LOSS'
        ) {

            openLoss++;
        }
    }


    var closedTrades =
        wins + losses;


    var winRate =
        closedTrades > 0
            ? (
                wins /
                closedTrades
            ) * 100
            : 0;


    var profitFactor;


    if (grossLoss > 0) {

        profitFactor =
            grossProfit /
            grossLoss;

    } else if (
        grossProfit > 0
    ) {

        profitFactor = Infinity;

    } else {

        profitFactor = 0;
    }


    /*
     * Expectancy:
     *
     * Average P&L per closed trade.
     */

    var expectancy =
        closedTrades > 0
            ? netPnl /
              closedTrades
            : 0;


    /*
     * Maximum drawdown.
     */

    var equity = 0;
    var peak = 0;
    var maxDrawdown = 0;


    for (
        var j = 0;
        j < trades.length;
        j++
    ) {

        equity +=
            num(
                trades[j].pnl
            );


        if (
            equity > peak
        ) {

            peak = equity;
        }


        var drawdown =
            peak - equity;


        if (
            drawdown >
            maxDrawdown
        ) {

            maxDrawdown =
                drawdown;
        }
    }


    /*
     * Risk-adjusted quality.
     */

    var quality = 0;


    if (closedTrades > 0) {

        quality =
            winRate * 0.5;


        if (
            profitFactor !== Infinity
        ) {

            quality +=
                clamp(
                    profitFactor *
                    20,
                    0,
                    40
                );

        } else {

            quality += 40;
        }


        if (
            maxDrawdown === 0
        ) {

            quality += 10;
        }
    }


    return {

        totalTrades:
            total,

        closedTrades:
            closedTrades,

        wins:
            wins,

        losses:
            losses,

        openProfit:
            openProfit,

        openLoss:
            openLoss,

        winRate:
            round(
                winRate,
                2
            ),

        grossProfit:
            round(
                grossProfit,
                4
            ),

        grossLoss:
            round(
                grossLoss,
                4
            ),

        netPnl:
            round(
                netPnl,
                4
            ),

        expectancy:
            round(
                expectancy,
                4
            ),

        profitFactor:
            profitFactor === Infinity
                ? null
                : round(
                    profitFactor,
                    3
                ),

        maxDrawdown:
            round(
                maxDrawdown,
                4
            ),

        historicalQuality:
            round(
                clamp(
                    quality,
                    0,
                    100
                ),
                2
            )
    };
}


/* =========================================================
   RUN BACKTEST
   ========================================================= */

function runBacktest(
    candles,
    signalProvider,
    options
) {

    options =
        options || {};


    if (
        !Array.isArray(candles) ||
        candles.length < 50
    ) {

        return {

            success: false,

            error:
                'At least 50 historical candles are required.',

            trades: [],

            metrics:
                calculateMetrics([])
        };
    }


    if (
        typeof signalProvider !==
        'function'
    ) {

        return {

            success: false,

            error:
                'signalProvider function is required.',

            trades: [],

            metrics:
                calculateMetrics([])
        };
    }


    var warmup =
        Number.isFinite(
            Number(options.warmup)
        )
            ? Number(options.warmup)
            : 50;


    warmup =
        Math.max(
            20,
            Math.min(
                warmup,
                candles.length - 1
            )
        );


    var cooldown =
        Number.isFinite(
            Number(options.cooldown)
        )
            ? Number(options.cooldown)
            : 1;


    cooldown =
        Math.max(
            1,
            cooldown
        );


    var trades = [];

    var nextAllowedIndex =
        warmup;


    /*
     * Walk through history one candle
     * at a time.
     */

    for (
        var i = warmup;
        i < candles.length - 1;
        i++
    ) {

        if (
            i < nextAllowedIndex
        ) {

            continue;
        }


        var signal;


        try {

            signal =
                signalProvider(
                    candles,
                    i
                );

        } catch (error) {

            continue;
        }


        if (!signal) {
            continue;
        }


        if (
            signal.signal !== 'BUY' &&
            signal.signal !== 'SELL'
        ) {

            continue;
        }


        /*
         * Ignore extremely weak signals
         * if minimum confidence is supplied.
         */

        if (
            options.minConfidence !==
            undefined
        ) {

            if (
                num(
                    signal.confidence
                ) <
                num(
                    options.minConfidence
                )
            ) {

                continue;
            }
        }


        var trade =
            simulateTrade(
                candles,
                i,
                signal
            );


        if (
            trade.result ===
            'INVALID'
        ) {

            continue;
        }


        trade.signal =
            signal.signal;


        trade.confidence =
            num(
                signal.confidence
            );


        trade.signalIndex =
            i;


        trades.push(
            trade
        );


        /*
         * Prevent overlapping positions.
         */

        nextAllowedIndex =
            i +
            Math.max(
                cooldown,
                trade.barsHeld + 1
            );
    }


    return {

        success: true,

        candles:
            candles.length,

        warmup:
            warmup,

        trades:
            trades,

        metrics:
            calculateMetrics(
                trades
            ),

        generatedAt:
            new Date().toISOString()
    };
}


/* =========================================================
   CONFIDENCE CALIBRATION
   ========================================================= */

function calibrateConfidence(
    trades
) {

    if (
        !Array.isArray(trades) ||
        trades.length === 0
    ) {

        return [];
    }


    /*
     * Group historical outcomes
     * into confidence buckets.
     */

    var buckets = {};


    for (
        var i = 0;
        i < trades.length;
        i++
    ) {

        var trade =
            trades[i];


        var confidence =
            Math.round(
                num(
                    trade.confidence
                ) / 10
            ) * 10;


        confidence =
            clamp(
                confidence,
                0,
                100
            );


        var key =
            String(
                confidence
            );


        if (!buckets[key]) {

            buckets[key] = {

                confidence:
                    confidence,

                trades: 0,

                wins: 0,

                losses: 0
            };
        }


        buckets[key].trades++;


        if (
            trade.result ===
            'WIN'
        ) {

            buckets[key].wins++;
        }


        if (
            trade.result ===
            'LOSS'
        ) {

            buckets[key].losses++;
        }
    }


    var result = [];

    var keys =
        Object.keys(
            buckets
        );


    for (
        var j = 0;
        j < keys.length;
        j++
    ) {

        var bucket =
            buckets[
                keys[j]
            ];


        var closed =
            bucket.wins +
            bucket.losses;


        bucket.historicalWinRate =
            closed > 0
                ? round(
                    (
                        bucket.wins /
                        closed
                    ) * 100,
                    2
                )
                : 0;


        result.push(
            bucket
        );
    }


    result.sort(
        function(a, b) {

            return (
                a.confidence -
                b.confidence
            );
        }
    );


    return result;
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    simulateTrade:
        simulateTrade,

    calculateMetrics:
        calculateMetrics,

    runBacktest:
        runBacktest,

    calibrateConfidence:
        calibrateConfidence
};
