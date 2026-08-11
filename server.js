'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const providerManager =
    require('./providers/providerManager');

const twelveDataProvider =
    require('./providers/twelveData');

const indicators =
    require('./engine/indicators');

const marketStructure =
    require('./engine/marketStructure');

const signalEngine =
    require('./engine/signalEngine');

const aiEngine =
    require('./engine/aiEngine');

const backtestEngine =
    require('./engine/backtestEngine');


/* =========================================================
   PROVIDER REGISTRATION
   ========================================================= */

providerManager.registerProvider(
    twelveDataProvider
);


/* =========================================================
   EXPRESS
   ========================================================= */

const app =
    express();

app.use(
    cors()
);

app.use(
    express.json()
);


/* =========================================================
   HTTP SERVER
   ========================================================= */

const server =
    http.createServer(app);


/* =========================================================
   WEBSOCKET
   ========================================================= */

const wss =
    new WebSocket.Server({
        server: server
    });


/* =========================================================
   PORT
   ========================================================= */

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   STATE
   ========================================================= */

const cache = {};


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

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


/* =========================================================
   NORMALIZE CANDLES
   ========================================================= */

function normalizeCandles(
    candles
) {

    if (
        !Array.isArray(candles)
    ) {

        return [];

    }


    return candles

        .map(
            function(candle) {

                return {

                    time:
                        candle.time ||
                        candle.datetime ||
                        null,

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

            }
        )

        .filter(
            function(candle) {

                return (

                    candle.open > 0 &&

                    candle.high > 0 &&

                    candle.low > 0 &&

                    candle.close > 0

                );

            }
        );

}


/* =========================================================
   LOAD MARKET HISTORY
   ========================================================= */

async function loadHistory(
    symbol,
    interval,
    outputsize
) {

    const normalizedSymbol =
        providerManager.normalizeSymbol(
            symbol
        );


    const selectedInterval =
        interval ||
        DEFAULT_INTERVAL;


    const key =
        normalizedSymbol +
        ':' +
        selectedInterval +
        ':' +
        outputsize;


    const existing =
        cache[key];


    /*
     * Short cache.
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


    /*
     * Provider Manager.
     */

    const result =
        await providerManager.getHistory(
            normalizedSymbol,
            selectedInterval,
            outputsize
        );


    if (
        !result ||
        !result.success
    ) {

        throw new Error(

            result &&
            (
                result.error ||
                result.reason
            )

            ?

            (
                result.error ||
                result.reason
            )

            :

            'Historical market data unavailable'

        );

    }


    const providerData =
        result.data;


    const candles =
        normalizeCandles(

            providerData &&
            providerData.candles

        );


    if (
        candles.length === 0
    ) {

        throw new Error(
            'Provider returned no valid candles'
        );

    }


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

    const normalizedSymbol =
        providerManager.normalizeSymbol(
            symbol
        );


    const result =
        await providerManager.getQuote(
            normalizedSymbol
        );


    if (
        !result ||
        !result.success
    ) {

        throw new Error(

            result &&
            (
                result.error ||
                result.reason
            )

            ?

            (
                result.error ||
                result.reason
            )

            :

            'Market quote unavailable'

        );

    }


    return result;

}


/* =========================================================
   TECHNICAL INDICATORS
   ========================================================= */

function calculateIndicators(
    candles
) {

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


    return {

        price:
            candles.length

                ?

                candles[
                    candles.length - 1
                ].close

                :

                0,

        ema20:
            null,

        ema50:
            null,

        ema200:
            null,

        rsi14:
            null,

        macd:
            null,

        atr14:
            null

    };

}


/* =========================================================
   MARKET STRUCTURE
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

        support:
            null,

        resistance:
            null

    };

}


/* =========================================================
   SIGNAL ENGINE
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
   BACKTEST
   ========================================================= */

function calculateBacktest(
    candles
) {

    if (
        !backtestEngine
    ) {

        return {

            available:
                false,

            reason:
                'Backtest engine unavailable'

        };

    }


    try {

        if (
            typeof backtestEngine.analyze ===
            'function'
        ) {

            return backtestEngine.analyze(
                candles
            );

        }


        if (
            typeof backtestEngine.run ===
            'function'
        ) {

            return backtestEngine.run(
                candles
            );

        }


        if (
            typeof backtestEngine.backtest ===
            'function'
        ) {

            return backtestEngine.backtest(
                candles
            );

        }


        return {

            available:
                false,

            reason:
                'No supported backtest function'

        };

    }
    catch(error) {

        return {

            available:
                false,

            error:
                error.message

        };

    }

}


/* =========================================================
   COMPLETE ANALYSIS
   ========================================================= */

async function analyzeSymbol(
    symbol,
    interval
) {

    const normalizedSymbol =
        providerManager.normalizeSymbol(
            symbol
        );


    const selectedInterval =
        interval ||
        DEFAULT_INTERVAL;


    /*
     * Historical candles.
     */

    const candles =
        await loadHistory(
            normalizedSymbol,
            selectedInterval,
            500
        );


    if (
        candles.length < 50
    ) {

        throw new Error(

            'Not enough historical candles for ' +
            normalizedSymbol +
            '. Received: ' +
            candles.length

        );

    }


    /*
     * Indicators.
     */

    const indicatorData =
        calculateIndicators(
            candles
        );


    /*
     * Structure.
     */

    const structure =
        calculateStructure(
            candles
        );


    /*
     * Technical signal.
     */

    const signal =
        calculateSignal(
            candles,
            indicatorData,
            structure
        );


    /*
     * Backtest.
     */

    const backtest =
        calculateBacktest(
            candles
        );


    /*
     * Current timeframe.
     *
     * Multi-timeframe engine will be
     * expanded later.
     */

    const timeframeAnalyses = {};


    timeframeAnalyses[
        selectedInterval
    ] =
        signal;


    /*
     * AI decision.
     */

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

    }
    else {

        decision = {

            decision:
                signal.signal ||
                'WAIT',

            confidence:
                safeNumber(
                    signal.confidence
                ),

            warning:
                'AI engine unavailable'

        };

    }


    /*
     * Latest candle.
     */

    const latest =
        candles[
            candles.length - 1
        ];


    return {

        symbol:
            normalizedSymbol,

        market:
            providerManager.detectMarket(
                normalizedSymbol
            ),

        interval:
            selectedInterval,

        timestamp:
            now(),

        candles:
            candles,

        candleCount:
            candles.length,

        latest:
            latest,

        indicators:
            indicatorData,

        structure:
            structure,

        signal:
            signal,

        ai:
            decision,

        backtest:
            backtest,

        source:
            'provider-manager'

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
                '2.1.0',

            websocket:
                'enabled',

            mode:
                'PROVIDER-BASED',

            engine:
                'multi-factor',

            providers:
                providerManager.getProviders(),

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

            providerCount:
                providerManager
                    .getProviders()
                    .length,

            providers:
                providerManager.getProviders(),

            websocket:
                true,

            timestamp:
                now()

        });

    }
);


/* =========================================================
   PROVIDERS
   ========================================================= */

app.get(
    '/api/providers',
    function(req, res) {

        res.json({

            success:
                true,

            providers:
                providerManager.getStatus(),

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
                req.params.symbol;


            const result =
                await providerManager.getPrice(
                    symbol
                );


            if (
                !result.success
            ) {

                return res
                    .status(503)
                    .json(
                        result
                    );

            }


            res.json(
                result
            );

        }
        catch(error) {

            console.error(
                'Price error:',
                error
            );


            res
                .status(500)
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

            const result =
                await providerManager.getQuote(
                    req.params.symbol
                );


            if (
                !result.success
            ) {

                return res
                    .status(503)
                    .json(
                        result
                    );

            }


            res.json(
                result
            );

        }
        catch(error) {

            console.error(
                'Quote error:',
                error
            );


            res
                .status(500)
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
                req.params.symbol;


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

                limit =
                    500;

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
                    providerManager.normalizeSymbol(
                        symbol
                    ),

                market:
                    providerManager.detectMarket(
                        symbol
                    ),

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

            console.error(
                'History error:',
                error
            );


            res
                .status(503)
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
   ANALYSIS
   ========================================================= */

app.get(
    '/api/analyze/:symbol',
    async function(req, res) {

        try {

            const symbol =
                req.params.symbol;


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


            res
                .status(503)
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
                    'Trader AI analysis server online',

                providers:
                    providerManager.getProviders()

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
                            request.type ||
                            ''
                        )
                        .trim()
                        .toUpperCase();


                    /* =====================================
                       GET PRICE
                       ===================================== */

                    if (
                        type ===
                        'GET_PRICE'
                    ) {

                        const result =
                            await providerManager
                                .getPrice(
                                    request.symbol
                                );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'PRICE',

                                data:
                                    result

                            })
                        );


                        return;

                    }


                    /* =====================================
                       GET QUOTE
                       ===================================== */

                    if (
                        type ===
                        'GET_QUOTE'
                    ) {

                        const result =
                            await providerManager
                                .getQuote(
                                    request.symbol
                                );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'QUOTE',

                                data:
                                    result

                            })
                        );


                        return;

                    }


                    /* =====================================
                       GET HISTORY
                       ===================================== */

                    if (
                        type ===
                        'GET_HISTORY'
                    ) {

                        const interval =
                            String(
                                request.interval ||
                                DEFAULT_INTERVAL
                            );


                        let limit =
                            Number(
                                request.limit ||
                                500
                            );


                        if (
                            !Number.isFinite(
                                limit
                            )
                        ) {

                            limit =
                                500;

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

                                request.symbol,

                                interval,

                                limit

                            );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'HISTORY',

                                symbol:
                                    providerManager
                                        .normalizeSymbol(
                                            request.symbol
                                        ),

                                interval:
                                    interval,

                                count:
                                    candles.length,

                                candles:
                                    candles

                            })
                        );


                        return;

                    }


                    /* =====================================
                       ANALYZE
                       ===================================== */

                    if (
                        type ===
                        'ANALYZE'
                    ) {

                        const interval =
                            String(
                                request.interval ||
                                DEFAULT_INTERVAL
                            );


                        const result =
                            await analyzeSymbol(

                                request.symbol,

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


                        return;

                    }


                    /* =====================================
                       PROVIDER STATUS
                       ===================================== */

                    if (
                        type ===
                        'PROVIDERS'
                    ) {

                        ws.send(
                            JSON.stringify({

                                type:
                                    'PROVIDERS',

                                providers:
                                    providerManager
                                        .getStatus()

                            })
                        );


                        return;

                    }


                    /* =====================================
                       PING
                       ===================================== */

                    if (
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


                        return;

                    }


                    /* =====================================
                       UNKNOWN
                       ===================================== */

                    ws.send(
                        JSON.stringify({

                            type:
                                'ERROR',

                            message:
                                'Unknown request type'

                        })
                    );

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
