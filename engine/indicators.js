'use strict';

/*
 * Trader AI
 * Technical Indicator Engine
 *
 * Input candle format:
 * {
 *   time: 1710000000000,
 *   open: 100,
 *   high: 105,
 *   low: 98,
 *   close: 103,
 *   volume: 150000
 * }
 */

function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
}


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function closes(candles) {
    return candles.map(function (c) {
        return number(c.close);
    });
}

function highs(candles) {
    return candles.map(function (c) {
        return number(c.high);
    });
}

function lows(candles) {
    return candles.map(function (c) {
        return number(c.low);
    });
}

function volumes(candles) {
    return candles.map(function (c) {
        return number(c.volume);
    });
}


/* =========================================================
   SMA
   ========================================================= */

function sma(values, period) {

    if (!Array.isArray(values) || values.length < period) {
        return null;
    }

    var sum = 0;

    for (var i = values.length - period; i < values.length; i++) {
        sum += number(values[i]);
    }

    return sum / period;
}


/* =========================================================
   EMA
   ========================================================= */

function ema(values, period) {

    if (!Array.isArray(values) || values.length < period) {
        return null;
    }

    var multiplier = 2 / (period + 1);

    var initialSum = 0;

    for (var i = 0; i < period; i++) {
        initialSum += number(values[i]);
    }

    var result = initialSum / period;

    for (var j = period; j < values.length; j++) {

        result =
            (number(values[j]) - result) * multiplier
            + result;
    }

    return result;
}


/* =========================================================
   RSI - WILDER STYLE
   ========================================================= */

function rsi(values, period) {

    if (!Array.isArray(values) || values.length < period + 1) {
        return null;
    }

    var gains = 0;
    var losses = 0;

    for (var i = 1; i <= period; i++) {

        var difference =
            number(values[i]) -
            number(values[i - 1]);

        if (difference > 0) {
            gains += difference;
        } else {
            losses += Math.abs(difference);
        }
    }

    var averageGain = gains / period;
    var averageLoss = losses / period;

    for (var j = period + 1; j < values.length; j++) {

        var change =
            number(values[j]) -
            number(values[j - 1]);

        var gain = change > 0 ? change : 0;
        var loss = change < 0 ? Math.abs(change) : 0;

        averageGain =
            ((averageGain * (period - 1)) + gain) /
            period;

        averageLoss =
            ((averageLoss * (period - 1)) + loss) /
            period;
    }

    if (averageLoss === 0) {
        return 100;
    }

    var rs =
        averageGain / averageLoss;

    return 100 - (100 / (1 + rs));
}


/* =========================================================
   MACD
   ========================================================= */

function macd(values, fastPeriod, slowPeriod, signalPeriod) {

    if (!Array.isArray(values) ||
        values.length < slowPeriod + signalPeriod) {
        return null;
    }

    var multiplierFast =
        2 / (fastPeriod + 1);

    var multiplierSlow =
        2 / (slowPeriod + 1);

    var fast =
        sma(values.slice(0, fastPeriod), fastPeriod);

    var slow =
        sma(values.slice(0, slowPeriod), slowPeriod);

    if (fast === null || slow === null) {
        return null;
    }

    var macdValues = [];

    /*
     * Build EMA values from the slow-period point onward.
     */

    var fastEma = fast;
    var slowEma = slow;

    for (var i = fastPeriod; i < slowPeriod; i++) {

        fastEma =
            (number(values[i]) - fastEma)
            * multiplierFast
            + fastEma;
    }

    macdValues.push(
        fastEma - slowEma
    );

    for (var j = slowPeriod; j < values.length; j++) {

        fastEma =
            (number(values[j]) - fastEma)
            * multiplierFast
            + fastEma;

        slowEma =
            (number(values[j]) - slowEma)
            * multiplierSlow
            + slowEma;

        macdValues.push(
            fastEma - slowEma
        );
    }

    if (macdValues.length < signalPeriod) {
        return null;
    }

    var signal =
        ema(
            macdValues,
            signalPeriod
        );

    var macdLine =
        macdValues[macdValues.length - 1];

    var histogram =
        signal === null
            ? null
            : macdLine - signal;

    return {
        macd: macdLine,
        signal: signal,
        histogram: histogram
    };
}


/* =========================================================
   TRUE RANGE
   ========================================================= */

function trueRanges(candles) {

    var result = [];

    for (var i = 0; i < candles.length; i++) {

        var current = candles[i];

        var high = number(current.high);
        var low = number(current.low);

        if (i === 0) {

            result.push(
                high - low
            );

        } else {

            var previousClose =
                number(candles[i - 1].close);

            result.push(
                Math.max(
                    high - low,
                    Math.abs(high - previousClose),
                    Math.abs(low - previousClose)
                )
            );
        }
    }

    return result;
}


/* =========================================================
   ATR
   ========================================================= */

function atr(candles, period) {

    if (!Array.isArray(candles) ||
        candles.length < period) {
        return null;
    }

    var trs =
        trueRanges(candles);

    return sma(
        trs,
        period
    );
}


/* =========================================================
   VWAP
   ========================================================= */

function vwap(candles) {

    if (!Array.isArray(candles) ||
        candles.length === 0) {
        return null;
    }

    var cumulativePriceVolume = 0;
    var cumulativeVolume = 0;

    for (var i = 0; i < candles.length; i++) {

        var high =
            number(candles[i].high);

        var low =
            number(candles[i].low);

        var close =
            number(candles[i].close);

        var volume =
            number(candles[i].volume);

        var typicalPrice =
            (high + low + close) / 3;

        cumulativePriceVolume +=
            typicalPrice * volume;

        cumulativeVolume += volume;
    }

    if (cumulativeVolume === 0) {
        return null;
    }

    return (
        cumulativePriceVolume /
        cumulativeVolume
    );
}


/* =========================================================
   STOCHASTIC
   ========================================================= */

function stochastic(candles, period) {

    if (!Array.isArray(candles) ||
        candles.length < period) {
        return null;
    }

    var recent =
        candles.slice(
            candles.length - period
        );

    var highest =
        Math.max.apply(
            null,
            highs(recent)
        );

    var lowest =
        Math.min.apply(
            null,
            lows(recent)
        );

    var close =
        number(
            recent[recent.length - 1].close
        );

    if (highest === lowest) {
        return 50;
    }

    return (
        ((close - lowest) /
        (highest - lowest)) * 100
    );
}


/* =========================================================
   OBV
   ========================================================= */

function obv(candles) {

    if (!Array.isArray(candles) ||
        candles.length < 2) {
        return null;
    }

    var value = 0;

    for (var i = 1; i < candles.length; i++) {

        var currentClose =
            number(candles[i].close);

        var previousClose =
            number(candles[i - 1].close);

        var volume =
            number(candles[i].volume);

        if (currentClose > previousClose) {

            value += volume;

        } else if (currentClose < previousClose) {

            value -= volume;
        }
    }

    return value;
}


/* =========================================================
   AVERAGE VOLUME
   ========================================================= */

function averageVolume(candles, period) {

    if (!Array.isArray(candles) ||
        candles.length < period) {
        return null;
    }

    return sma(
        volumes(candles),
        period
    );
}


/* =========================================================
   VOLUME RATIO
   ========================================================= */

function volumeRatio(candles, period) {

    if (!Array.isArray(candles) ||
        candles.length < period + 1) {
        return null;
    }

    var currentVolume =
        number(
            candles[candles.length - 1].volume
        );

    var previous =
        candles.slice(
            candles.length - period - 1,
            candles.length - 1
        );

    var avg =
        averageVolume(
            previous,
            period
        );

    if (avg === null || avg === 0) {
        return null;
    }

    return currentVolume / avg;
}


/* =========================================================
   PRICE CHANGE
   ========================================================= */

function priceChange(candles, lookback) {

    if (!Array.isArray(candles) ||
        candles.length <= lookback) {
        return null;
    }

    var current =
        number(
            candles[candles.length - 1].close
        );

    var previous =
        number(
            candles[candles.length - 1 - lookback].close
        );

    if (previous === 0) {
        return null;
    }

    return (
        ((current - previous) / previous)
        * 100
    );
}


/* =========================================================
   BOLLINGER BANDS
   ========================================================= */

function bollingerBands(
    values,
    period,
    standardDeviations
) {

    if (!Array.isArray(values) ||
        values.length < period) {
        return null;
    }

    var recent =
        values.slice(
            values.length - period
        );

    var mean =
        sma(
            recent,
            period
        );

    if (mean === null) {
        return null;
    }

    var variance = 0;

    for (var i = 0; i < recent.length; i++) {

        variance +=
            Math.pow(
                number(recent[i]) - mean,
                2
            );
    }

    variance =
        variance / period;

    var standardDeviation =
        Math.sqrt(variance);

    var multiplier =
        standardDeviations || 2;

    return {

        middle: mean,

        upper:
            mean +
            multiplier *
            standardDeviation,

        lower:
            mean -
            multiplier *
            standardDeviation
    };
}


/* =========================================================
   CANDLE BODY / RANGE
   ========================================================= */

function candleStats(candle) {

    if (!candle) {
        return null;
    }

    var open =
        number(candle.open);

    var high =
        number(candle.high);

    var low =
        number(candle.low);

    var close =
        number(candle.close);

    var range =
        high - low;

    var body =
        Math.abs(close - open);

    var upperWick =
        high -
        Math.max(open, close);

    var lowerWick =
        Math.min(open, close) -
        low;

    return {

        range: range,

        body: body,

        upperWick: upperWick,

        lowerWick: lowerWick,

        bullish:
            close > open,

        bearish:
            close < open,

        bodyPercent:
            range === 0
                ? 0
                : (body / range) * 100
    };
}


/* =========================================================
   COMPLETE INDICATOR SNAPSHOT
   ========================================================= */

function calculateAll(candles) {

    if (!Array.isArray(candles) ||
        candles.length === 0) {

        return {
            valid: false,
            reason: 'No candle data'
        };
    }

    var closeValues =
        closes(candles);

    var current =
        candles[candles.length - 1];

    var currentPrice =
        number(current.close);


    var result = {

        valid: true,

        price: currentPrice,

        sma20:
            sma(closeValues, 20),

        sma50:
            sma(closeValues, 50),

        sma200:
            sma(closeValues, 200),

        ema9:
            ema(closeValues, 9),

        ema20:
            ema(closeValues, 20),

        ema50:
            ema(closeValues, 50),

        ema200:
            ema(closeValues, 200),

        rsi14:
            rsi(closeValues, 14),

        macd:
            macd(
                closeValues,
                12,
                26,
                9
            ),

        atr14:
            atr(candles, 14),

        vwap:
            vwap(candles),

        stochastic14:
            stochastic(candles, 14),

        obv:
            obv(candles),

        averageVolume20:
            averageVolume(candles, 20),

        volumeRatio20:
            volumeRatio(candles, 20),

        change1:
            priceChange(candles, 1),

        change5:
            priceChange(candles, 5),

        change20:
            priceChange(candles, 20),

        bollinger:
            bollingerBands(
                closeValues,
                20,
                2
            ),

        lastCandle:
            candleStats(current)
    };


    /*
     * Simple relative position information.
     */

    if (result.ema20 !== null) {

        result.priceVsEMA20 =
            currentPrice >
            result.ema20
                ? 'ABOVE'
                : 'BELOW';
    }


    if (result.vwap !== null) {

        result.priceVsVWAP =
            currentPrice >
            result.vwap
                ? 'ABOVE'
                : 'BELOW';
    }


    /*
     * RSI state.
     */

    if (result.rsi14 !== null) {

        if (result.rsi14 >= 70) {

            result.rsiState =
                'OVERBOUGHT';

        } else if (result.rsi14 <= 30) {

            result.rsiState =
                'OVERSOLD';

        } else {

            result.rsiState =
                'NEUTRAL';
        }
    }


    /*
     * MACD state.
     */

    if (result.macd !== null) {

        if (
            result.macd.macd >
            result.macd.signal
        ) {

            result.macdState =
                'BULLISH';

        } else if (
            result.macd.macd <
            result.macd.signal
        ) {

            result.macdState =
                'BEARISH';

        } else {

            result.macdState =
                'NEUTRAL';
        }
    }


    /*
     * EMA trend state.
     */

    if (
        result.ema9 !== null &&
        result.ema20 !== null
    ) {

        if (
            result.ema9 >
            result.ema20
        ) {

            result.emaTrend =
                'BULLISH';

        } else if (
            result.ema9 <
            result.ema20
        ) {

            result.emaTrend =
                'BEARISH';

        } else {

            result.emaTrend =
                'NEUTRAL';
        }
    }


    return result;
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    sma: sma,

    ema: ema,

    rsi: rsi,

    macd: macd,

    atr: atr,

    vwap: vwap,

    stochastic: stochastic,

    obv: obv,

    averageVolume: averageVolume,

    volumeRatio: volumeRatio,

    priceChange: priceChange,

    bollingerBands: bollingerBands,

    candleStats: candleStats,

    calculateAll: calculateAll
};
