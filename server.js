'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const providerManager =
    require('./providers/providerManager');

const twelveData =
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
   PROVIDERS
   ========================================================= */

providerManager.registerProvider(
    twelveData
);


/* =========================================================
   APP
   ========================================================= */

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
   CACHE
   ========================================================= */

const historyCache = {};

const CACHE_MS = 15000;


/* =========================================================
   HELPERS
   ========================================================= */

function now() {
    return Date.now();
}


function number(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;

}


function normalizeCandles(candles) {

    if (!Array.isArray(candles)) {
        return [];
    }

    return candles
        .map(function(c) {

            return {

                time:
                    c.time ||
                    c.datetime ||
                    null,

                open:
                    number(c.open),

                high:
                    number(c.high),

                low:
                    number(c.low),

                close:
                    number(c.close),

                volume:
                    number(c.volume)

            };

        })
        .filter(function(c) {

            return (
                c.open > 0 &&
                c.high > 0 &&
                c.low > 0 &&
                c.close > 0
            );

        });

}


/* =========================================================
   HISTORY
   ========================================================= */

async function loadHistory(
    symbol,
    interval,
    limit
) {

    const normalized =
        providerManager.normalizeSymbol(
            symbol
        );


    const selectedInterval =
        interval || '1min';


    const selectedLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 500,
                5000
            )
        );


    const key =
        normalized +
        ':' +
        selectedInterval +
        ':' +
        selectedLimit;


    const cached =
        historyCache[key];


    if (
        cached &&
        now() - cached.time < CACHE_MS
    ) {

        return cached.data;

    }


    const result =
        await providerManager.getHistory(

            normalized,

            selectedInterval,

            selectedLimit

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

            'Market history unavailable'

        );

    }


    const candles =
        normalizeCandles(
            result.data &&
            result.data.candles
        );


    if (
        candles.length === 0
    ) {

        throw new Error(
            'Provider returned no valid candles'
        );

    }


    historyCache[key] = {

        time:
            now(),

        data:
            candles

    };


    return candles;

}


/* =========================================================
   INDICATORS
   ========================================================= */

function calculateIndicators(candles) {

    if (
        indicators &&
        typeof indicators.analyze === 'function'
    ) {

        return indicators.analyze(
            candles
        );

    }


    if (
        indicators &&
        typeof indicators.calculate === 'function'
    ) {

        return indicators.calculate(
            candles
        );

    }


    return {

        price:
            candles.length
                ? candles[candles.length - 1].close
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
   MARKET STRUCTURE
   ========================================================= */

function calculateStructure(candles) {

    if (
        marketStructure &&
        typeof marketStructure.analyze === 'function'
    ) {

        return marketStructure.analyze(
            candles
        );

    }


    if (
        marketStructure &&
        typeof marketStructure.detect === 'function'
    ) {

        return marketStructure.detect(
            candles
        );

    }


    return {

        trend: 'NEUTRAL',

        support: null,

        resistance: null

    };

}


/* =========================================================
   SIGNAL
   ========================================================= */

function calculateSignal(
    candles,
    indicatorsData,
    structure
) {

    if (
        signalEngine &&
        typeof signalEngine.analyze === 'function'
    ) {

        return signalEngine.analyze(

            candles,

            indicatorsData,

            structure

        );

    }


    if (
        signalEngine &&
        typeof signalEngine.generateSignal === 'function'
    ) {

        return signalEngine.generateSignal(

            candles,

            indicatorsData,

            structure

        );

    }


    return {

        signal: 'WAIT',

        confidence: 0,

        score: 0,

        reasons: [
            'Signal engine unavailable'
        ]

    };

}


/* =========================================================
   BACKTEST
   ========================================================= */

function calculateBacktest(candles) {

    if (!backtestEngine) {

        return {

            available: false

        };

    }


    try {

        if (
            typeof backtestEngine.analyze === 'function'
        ) {

            return backtestEngine.analyze(
                candles
            );

        }


        if (
            typeof backtestEngine.run === 'function'
        ) {

            return backtestEngine.run(
                candles
            );

        }


        if (
            typeof backtestEngine.backtest === 'function'
        ) {

            return backtestEngine.backtest(
                candles
            );

        }

    }
    catch(error) {

        return {

            available: false,

            error:
                error.message

        };

    }


    return {

        available: false

    };

}


/* =========================================================
   COMPLETE ANALYSIS
   ========================================================= */

async function analyzeSymbol(
    symbol,
    interval
) {

    const normalized =
        providerManager.normalizeSymbol(
            symbol
        );


    const selectedInterval =
        interval || '1min';


    const candles =
        await loadHistory(

            normalized,

            selectedInterval,

            500

        );


    if (
        candles.length < 50
    ) {

        throw new Error(

            'Not enough candles. Received ' +
            candles.length

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


    const backtest =
        calculateBacktest(
            candles
        );


    let ai;


    if (
        aiEngine &&
        typeof aiEngine.analyze === 'function'
    ) {

        ai =
            aiEngine.analyze(

                signal,

                indicatorData,

                structure,

                {
                    [selectedInterval]:
                        signal
                }

            );

    }
    else {

        ai = {

            decision:
                signal.signal || 'WAIT',

            confidence:
                number(signal.confidence),

            warning:
                'AI engine unavailable'

        };

    }


    return {

        symbol:
            normalized,

        market:
            providerManager.detectMarket(
                normalized
            ),

        interval:
            selectedInterval,

        timestamp:
            now(),

        candleCount:
            candles.length,

        latest:
            candles[candles.length - 1],

        indicators:
            indicatorData,

        structure:
            structure,

        signal:
            signal,

        ai:
            ai,

        backtest:
            backtest

    };

}


/* =========================================================
   ROOT
   ========================================================= */

app.get('/', function(req, res) {

    res.json({

        app:
            'Trader AI',

        status:
            'online',

        version:
            '3.0.0',

        websocket:
            true,

        architecture:
            'multi-provider',

        providers:
            providerManager.getProviders(),

        warning:
            'Market analysis is probabilistic and does not guarantee future price movement.'

    });

});


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    '/api/health',
    function(req, res) {

        res.json({

            status:
                'ok',

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

            const result =
                await providerManager.getPrice(
                    req.params.symbol
                );


            if (!result.success) {

                return res
                    .status(503)
                    .json(result);

            }


            res.json(result);

        }
        catch(error) {

            res.status(500).json({

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


            if (!result.success) {

                return res
                    .status(503)
                    .json(result);

            }


            res.json(result);

        }
        catch(error) {

            res.status(500).json({

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

            const interval =
                String(
                    req.query.interval ||
                    '1min'
                );


            const limit =
                Math.max(
                    1,
                    Math.min(
                        Number(req.query.limit) || 500,
                        5000
                    )
                );


            const candles =
                await loadHistory(

                    req.params.symbol,

                    interval,

                    limit

                );


            res.json({

                success:
                    true,

                symbol:
                    providerManager.normalizeSymbol(
                        req.params.symbol
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

            const result =
                await analyzeSymbol(

                    req.params.symbol,

                    String(
                        req.query.interval ||
                        '1min'
                    )

                );


            res.json({

                success:
                    true,

                result:
                    result

            });

        }
        catch(error) {

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

        ws.send(
            JSON.stringify({

                type:
                    'CONNECTED',

                timestamp:
                    now(),

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
                            request.type || ''
                        )
                        .toUpperCase();


                    if (
                        type === 'PING'
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


                    if (
                        type === 'PROVIDERS'
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


                    if (
                        type === 'GET_PRICE'
                    ) {

                        const result =
                            await providerManager.getPrice(
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


                    if (
                        type === 'GET_QUOTE'
                    ) {

                        const result =
                            await providerManager.getQuote(
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


                    if (
                        type === 'GET_HISTORY'
                    ) {

                        const candles =
                            await loadHistory(

                                request.symbol,

                                request.interval ||
                                '1min',

                                request.limit ||
                                500

                            );


                        ws.send(
                            JSON.stringify({

                                type:
                                    'HISTORY',

                                candles:
                                    candles

                            })
                        );

                        return;

                    }


                    if (
                        type === 'ANALYZE'
                    ) {

                        const result =
                            await analyzeSymbol(

                                request.symbol,

                                request.interval ||
                                '1min'

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

    }
);


/* =========================================================
   START
   ========================================================= */

server.listen(
    PORT,
    function() {

        console.log(
            'Trader AI running on port ' +
            PORT
        );

    }
);