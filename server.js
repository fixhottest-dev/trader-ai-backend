'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const marketData = require('./marketData');

const indicators = require('./engine/indicators');
const marketStructure = require('./engine/marketStructure');
const signalEngine = require('./engine/signalEngine');
const aiEngine = require('./engine/aiEngine');
const backtestEngine = require('./engine/backtestEngine');


const app = express();

app.use(cors());
app.use(express.json());

const server =
    http.createServer(app);

const wss =
    new WebSocket.Server({
        server: server
    });

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   STATE
   ========================================================= */

const cache = {};

const DEFAULT_SYMBOLS = [
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFCBANK',
    'ICICIBANK',
    'SBIN',
    'NIFTY',
    'BANKNIFTY'
];


const DEFAULT_INTERVAL =
    '1min';


const CACHE_MS =
    15000;


/* =========================================================
   HELPERS
   ========================================================= */

function now() {
    return Date.now();
}


function safeNumber(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


function normalizeCandles(
    candles
) {

    if (!Array.isArray(candles)) {
        return [];
    }


    return candles
        .map(function(candle) {

            return {

                time:
                    candle.time ||
                    candle.datetime,

                open:
                    safeNumber(
                        candle.open
                    ),

                high:
                    safeNumber(
                        candle.high
                    ),

                low:
                    safeNumber(
                        candle.low
                    ),

                close:
                    safeNumber(
                        candle.close
                    ),

                volume:
                    safeNumber(
                        candle.volume
                    )

            };

        })
        .filter(function(candle) {

            return (
                candle.open > 0 &&
                candle.high > 0 &&
                candle.low > 0 &&
                candle.close > 0
            );

        });
}


/* =========================================================
   LOAD MARKET HISTORY
   ========================================================= */

async function loadHistory(
    symbol,
    interval,
    outputsize
) {

    const key =
        symbol +
        ':' +
        interval;


    const existing =
        cache[key];


    /*
     * Short cache prevents us from
     * hammering the provider.
     */

    if (
        existing &&
        (
            now() -
            existing.timestamp
        ) < CACHE_MS
    ) {

        return existing.data;
    }


    const data =
        await marketData.getHistory(
            symbol,
            interval,
            outputsize
        );


    const candles =
        normalizeCandles(
            data.candles
        );


    cache[key] = {

        timestamp:
            now(),

        data:
            candles

    };


    return candles;
}


/* =========================================================
   MARKET SNAPSHOT
   ========================================================= */

async function getMarketSnapshot(
    symbol
) {

    const quote =
        await marketData.getQuote(
            symbol
        );


    return quote;
}


/* =========================================================
   TECHNICAL ANALYSIS
   ========================================================= */

function calculateIndicators(
    candles
) {

    /*
     * This adapter intentionally supports
     * different indicator.js export styles.
     */

    if (
        indicators &&
        typeof indicators.analyze ===
        'function'
    ) {

        return indicators.analyze(
            candles
        );
    }


    if (
        indicators &&
        typeof indicators.calculate ===
        'function'
    ) {

        return indicators.calculate(
            candles
        );
    }


    /*
     * Fallback.
     */

    return {

        price:
            candles.length
                ? candles[
                    candles.length - 1
                  ].close
                : 0,

        ema20: null,

        ema50: null,

        ema200: null,

        rsi14: null,

        macd: null,

        atr14: null

    };
}


/* =========================================================
   STRUCTURE
   ========================================================= */

function calculateStructure(
    candles
) {

    if (
        marketStructure &&
        typeof marketStructure.analyze ===
        'function'
    ) {

        return marketStructure.analyze(
            candles
        );
    }


    if (
        marketStructure &&
        typeof marketStructure.detect ===
        'function'
    ) {

        return marketStructure.detect(
            candles
        );
    }


    return {

        trend:
            'NEUTRAL',

        support: null,

        resistance: null

    };
}


/* =========================================================
   TECHNICAL SIGNAL
   ========================================================= */

function calculateSignal(
    candles,
    indicatorData,
    structure
) {

    if (
        signalEngine &&
        typeof signalEngine.analyze ===
        'function'
    ) {

        return signalEngine.analyze(
            candles,
            indicatorData,
            structure
        );
    }


    if (
        signalEngine &&
        typeof signalEngine.generateSignal ===
        'function'
    ) {

        return signalEngine.generateSignal(
            candles,
            indicatorData,
            structure
        );
    }


    return {

        signal:
            'WAIT',

        confidence:
            0,

        score:
            0,

        reasons: [
            'Signal engine unavailable'
        ]

    };
}


/* =========================================================
   COMPLETE ANALYSIS
   ========================================================= */

async function analyzeSymbol(
    symbol,
    interval
) {

    const candles =
        await loadHistory(
            symbol,
            interval || DEFAULT_INTERVAL,
            500
        );


    if (
        candles.length < 50
    ) {

        throw new Error(
            'Not enough historical candles for ' +
            symbol
        );
    }


    const indicatorData =
        calculateIndicators(
            candles
        );


    const structure =
        calculateStructure(
            candles
        );


    const signal =
        calculateSignal(
            candles,
            indicatorData,
            structure
        );


    /*
     * Current implementation uses the
     * same timeframe as the base analysis.
     *
     * Multi-timeframe expansion comes next.
     */

    const timeframeAnalyses = {

        [interval || DEFAULT_INTERVAL]:
            signal

    };


    let decision;


    if (
        aiEngine &&
        typeof aiEngine.analyze ===
        'function'
    ) {

        decision =
            aiEngine.analyze(
                signal,
                indicatorData,
                structure,
                timeframeAnalyses
            );

    } else {

        decision = {

            decision:
                signal.signal || 'WAIT',

            confidence:
                safeNumber(
                    signal.confidence
                ),

            warning:
                'AI engine unavailable'

        };
    }


    return {

        symbol:
            symbol,

        interval:
            interval ||
            DEFAULT_INTERVAL,

        timestamp:
            now(),

        candles:
            candles,

        latest:
            candles[
                candles.length - 1
            ],

        indicators:
            indicatorData,

        structure:
            structure,

        signal:
            signal,

        ai:
            decision,

        source:
            'market-data-provider'

    };
}


/* =========================================================
   ROOT
   ========================================================= */

app.get(
    '/',
    function(req, res) {

        res.json({

            app:
                'Trader AI',

            status:
                'online',

            version:
                '2.0.0',

            websocket:
                'enabled',

            mode:
                process.env.TWELVE_DATA_API_KEY
                    ? 'LIVE-DATA'
                    : 'NO-DATA-KEY',

            engine:
                'multi-factor',

            warning:
                'Analysis is probabilistic and does not guarantee future price movement.'

        });

    }
);


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    '/api/health',
    function(req, res) {

        res.json({

            status:
                'ok',

            marketData:
                !!process.env.TWELVE_DATA_API_KEY,

            websocket:
                true,

            timestamp:
                now()

        });

    }
);


/* =========================================================
   PRICE
   ========================================================= */

app.get(
    '/api/price/:symbol',
    async function(req, res) {

        try {

            const symbol =
                req.params.symbol
                    .toUpperCase();


            const result =
                await marketData.getPrice(
                    symbol
                );


            res.json({

                success:
                    true,

                data:
                    result

            });

        }
        catch(error) {

            res.status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   QUOTE
   ========================================================= */

app.get(
    '/api/quote/:symbol',
    async function(req, res) {

        try {

            const symbol =
                req.params.symbol
                    .toUpperCase();


            const result =
                await getMarketSnapshot(
                    symbol
                );


            res.json({

                success:
                    true,

                data:
                    result

            });

        }
        catch(error) {

            res.status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   HISTORY
   ========================================================= */

app.get(
    '/api/history/:symbol',
    async function(req, res) {

        try {

            const symbol =
                req.params.symbol
                    .toUpperCase();


            const interval =
                String(
                    req.query.interval ||
                    DEFAULT_INTERVAL
                );


            let limit =
                Number(
                    req.query.limit ||
                    500
                );


            if (
                !Number.isFinite(limit)
            ) {

                limit = 500;
            }


            limit =
                Math.max(
                    1,
                    Math.min(
                        limit,
                        5000
                    )
                );


            const candles =
                await loadHistory(
                    symbol,
                    interval,
                    limit
                );


            res.json({

                success:
                    true,

                symbol:
                    symbol,

                interval:
                    interval,

                count:
                    candles.length,

                candles:
                    candles,

                timestamp:
                    now()

            });

        }
        catch(error) {

            res.status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   AI ANALYSIS
   ========================================================= */

app.get(
    '/api/analyze/:symbol',
    async function(req, res) {

        try {

            const symbol =
                req.params.symbol
                    .toUpperCase();


            const interval =
                String(
                    req.query.interval ||
                    DEFAULT_INTERVAL
                );


            const result =
                await analyzeSymbol(
                    symbol,
                    interval
                );


            res.json({

                success:
                    true,

                result:
                    result

            });

        }
        catch(error) {

            console.error(
                'Analysis error:',
                error
            );


            res.status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   WEBSOCKET
   ========================================================= */

wss.on(
    'connection',
    function(ws) {

        console.log(
            'Trader AI client connected'
        );


        ws.send(
            JSON.stringify({

                type:
                    'CONNECTED',

                timestamp:
                    now(),

                message:
                    'Trader AI analysis server online'

            })
        );


        ws.on(
            'message',
            async function(raw) {

                try {

                    const request =
                        JSON.parse(
                            raw.toString()
                        );


                    const type =
                        String(
                            request.type || ''
                        ).toUpperCase();


                    /* =========================
                       PRICE
                    ========================== */

                    if (
                        type ===
                        'GET_PRICE'
                    ) {

                        const symbol =
                            String(
                                request.symbol ||
                                ''
                            )
                            .toUpperCase();


                        const result =
                            await marketData
                                .getPrice(
                                    symbol
                                );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'PRICE',

                                data:
                                    result

                            })
                        );
                    }


                    /* =========================
                       HISTORY
                    ========================== */

                    else if (
                        type ===
                        'GET_HISTORY'
                    ) {

                        const symbol =
                            String(
                                request.symbol ||
                                ''
                            )
                            .toUpperCase();


                        const interval =
                            String(
                                request.interval ||
                                DEFAULT_INTERVAL
                            );


                        const limit =
                            Math.max(
                                1,
                                Math.min(
                                    Number(
                                        request.limit ||
                                        500
                                    ),
                                    5000
                                )
                            );


                        const candles =
                            await loadHistory(
                                symbol,
                                interval,
                                limit
                            );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'HISTORY',

                                symbol:
                                    symbol,

                                interval:
                                    interval,

                                candles:
                                    candles

                            })
                        );
                    }


                    /* =========================
                       AI ANALYSIS
                    ========================== */

                    else if (
                        type ===
                        'ANALYZE'
                    ) {

                        const symbol =
                            String(
                                request.symbol ||
                                ''
                            )
                            .toUpperCase();


                        const interval =
                            String(
                                request.interval ||
                                DEFAULT_INTERVAL
                            );


                        const result =
                            await analyzeSymbol(
                                symbol,
                                interval
                            );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'ANALYSIS',

                                result:
                                    result

                            })
                        );
                    }


                    /* =========================
                       PING
                    ========================== */

                    else if (
                        type ===
                        'PING'
                    ) {

                        ws.send(
                            JSON.stringify({

                                type:
                                    'PONG',

                                timestamp:
                                    now()

                            })
                        );
                    }


                    else {

                        ws.send(
                            JSON.stringify({

                                type:
                                    'ERROR',

                                message:
                                    'Unknown request type'

                            })
                        );

                    }

                }
                catch(error) {

                    console.error(
                        'WebSocket error:',
                        error
                    );


                    ws.send(
                        JSON.stringify({

                            type:
                                'ERROR',

                            message:
                                error.message

                        })
                    );

                }

            }
        );


        ws.on(
            'close',
            function() {

                console.log(
                    'Trader AI client disconnected'
                );

            }
        );

    }
);


/* =========================================================
   SERVER
   ========================================================= */

server.listen(
    PORT,
    function() {

        console.log(
            'Trader AI listening on port ' +
            PORT
        );

    }
);
