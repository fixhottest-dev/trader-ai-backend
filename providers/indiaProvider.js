'use strict';

const https = require('https');


/* =========================================================
   GROWw INDIA PROVIDER
   ========================================================= */

const provider = {

    name:
        'growwIndia',

    markets: [
        'INDIA'
    ],

    capabilities: [
        'price',
        'quote',
        'history'
    ],


    /* =====================================================
       SYMBOL SUPPORT
       ===================================================== */

    canHandle:
        function(symbol, market, operation) {

            if (
                market !== 'INDIA'
            ) {

                return false;

            }


            if (
                !operation
            ) {

                return false;

            }


            return true;

        },


    /* =====================================================
       HTTP GET
       ===================================================== */

    request:
        function(path) {

            return new Promise(
                function(resolve, reject) {

                    const token =
                        process.env.GROWW_ACCESS_TOKEN;


                    if (!token) {

                        reject(
                            new Error(
                                'GROWW_ACCESS_TOKEN is not configured'
                            )
                        );

                        return;

                    }


                    const options = {

                        hostname:
                            'api.groww.in',

                        path:
                            path,

                        method:
                            'GET',

                        headers: {

                            'Accept':
                                'application/json',

                            'Authorization':
                                'Bearer ' +
                                token,

                            'X-API-VERSION':
                                '1.0'

                        }

                    };


                    const request =
                        https.request(
                            options,
                            function(response) {

                                let body = '';


                                response.on(
                                    'data',
                                    function(chunk) {

                                        body +=
                                            chunk.toString();

                                    }
                                );


                                response.on(
                                    'end',
                                    function() {

                                        if (
                                            response.statusCode < 200 ||
                                            response.statusCode >= 300
                                        ) {

                                            reject(

                                                new Error(

                                                    'Groww HTTP ' +
                                                    response.statusCode +
                                                    ': ' +
                                                    body

                                                )

                                            );

                                            return;

                                        }


                                        try {

                                            const json =
                                                JSON.parse(
                                                    body
                                                );


                                            resolve(
                                                json
                                            );

                                        }
                                        catch(error) {

                                            reject(

                                                new Error(
                                                    'Invalid Groww JSON response'
                                                )

                                            );

                                        }

                                    }
                                );

                            }
                        );


                    request.on(
                        'error',
                        function(error) {

                            reject(
                                error
                            );

                        }
                    );


                    request.end();

                }
            );

        },


    /* =====================================================
       SYMBOL PARSER
       ===================================================== */

    parseSymbol:
        function(symbol) {

            let value =
                String(symbol || '')
                    .trim()
                    .toUpperCase();


            value =
                value.replace(
                    'NSE:',
                    ''
                );


            value =
                value.replace(
                    'BSE:',
                    ''
                );


            return value;

        },


    /* =====================================================
       PRICE
       ===================================================== */

    getPrice:
        async function(symbol) {

            const tradingSymbol =
                provider.parseSymbol(
                    symbol
                );


            const path =
                '/v1/live-data/ltp' +
                '?segment=CASH' +
                '&exchange_symbols=' +
                encodeURIComponent(
                    'NSE_' +
                    tradingSymbol
                );


            const response =
                await provider.request(
                    path
                );


            if (
                !response ||
                response.status !==
                'SUCCESS'
            ) {

                throw new Error(
                    'Groww price request failed'
                );

            }


            const payload =
                response.payload || {};


            const key =
                'NSE_' +
                tradingSymbol;


            const price =
                Number(
                    payload[key]
                );


            if (
                !Number.isFinite(price) ||
                price <= 0
            ) {

                throw new Error(
                    'Groww returned invalid price'
                );

            }


            return {

                symbol:
                    'NSE:' +
                    tradingSymbol,

                price:
                    price,

                timestamp:
                    Date.now()

            };

        },


    /* =====================================================
       QUOTE
       ===================================================== */

    getQuote:
        async function(symbol) {

            const tradingSymbol =
                provider.parseSymbol(
                    symbol
                );


            const path =
                '/v1/live-data/quote' +
                '?exchange=NSE' +
                '&segment=CASH' +
                '&trading_symbol=' +
                encodeURIComponent(
                    tradingSymbol
                );


            const response =
                await provider.request(
                    path
                );


            if (
                !response ||
                response.status !==
                'SUCCESS'
            ) {

                throw new Error(
                    'Groww quote request failed'
                );

            }


            return {

                symbol:
                    'NSE:' +
                    tradingSymbol,

                quote:
                    response.payload || {},

                timestamp:
                    Date.now()

            };

        },


    /* =====================================================
       HISTORY
       ===================================================== */

    getHistory:
        async function(
            symbol,
            interval,
            limit
        ) {

            const tradingSymbol =
                provider.parseSymbol(
                    symbol
                );


            let intervalMinutes =
                1;


            const value =
                String(
                    interval ||
                    '1min'
                )
                .toLowerCase();


            if (
                value === '1min' ||
                value === '1minute'
            ) {

                intervalMinutes =
                    1;

            }
            else if (
                value === '5min' ||
                value === '5minute'
            ) {

                intervalMinutes =
                    5;

            }
            else if (
                value === '10min' ||
                value === '10minute'
            ) {

                intervalMinutes =
                    10;

            }
            else if (
                value === '15min' ||
                value === '15minute'
            ) {

                intervalMinutes =
                    15;

            }
            else if (
                value === '30min' ||
                value === '30minute'
            ) {

                intervalMinutes =
                    30;

            }
            else if (
                value === '1h' ||
                value === '60min' ||
                value === '60minute'
            ) {

                intervalMinutes =
                    60;

            }
            else if (
                value === '4h' ||
                value === '240min'
            ) {

                intervalMinutes =
                    240;

            }
            else if (
                value === '1d' ||
                value === '1day'
            ) {

                intervalMinutes =
                    1440;

            }
            else {

                intervalMinutes =
                    1;

            }


            let requested =
                Number(
                    limit || 500
                );


            if (
                !Number.isFinite(
                    requested
                )
            ) {

                requested =
                    500;

            }


            requested =
                Math.max(
                    1,
                    Math.min(
                        requested,
                        500
                    )
                );


            /*
             * Groww historical API requires
             * start and end timestamps.
             *
             * We calculate a reasonable
             * lookback from requested candles.
             */

            const end =
                new Date();


            const milliseconds =
                requested *
                intervalMinutes *
                60 *
                1000;


            const start =
                new Date(
                    end.getTime() -
                    milliseconds -
                    (
                        24 *
                        60 *
                        60 *
                        1000
                    )
                );


            function formatDate(date) {

                const year =
                    date.getFullYear();


                const month =
                    String(
                        date.getMonth() + 1
                    )
                    .padStart(
                        2,
                        '0'
                    );


                const day =
                    String(
                        date.getDate()
                    )
                    .padStart(
                        2,
                        '0'
                    );


                const hours =
                    String(
                        date.getHours()
                    )
                    .padStart(
                        2,
                        '0'
                    );


                const minutes =
                    String(
                        date.getMinutes()
                    )
                    .padStart(
                        2,
                        '0'
                    );


                const seconds =
                    String(
                        date.getSeconds()
                    )
                    .padStart(
                        2,
                        '0'
                    );


                return (

                    year +
                    '-' +
                    month +
                    '-' +
                    day +
                    ' ' +
                    hours +
                    ':' +
                    minutes +
                    ':' +
                    seconds

                );

            }


            const path =
                '/v1/historical/candle/range' +
                '?exchange=NSE' +
                '&segment=CASH' +
                '&trading_symbol=' +
                encodeURIComponent(
                    tradingSymbol
                ) +
                '&start_time=' +
                encodeURIComponent(
                    formatDate(start)
                ) +
                '&end_time=' +
                encodeURIComponent(
                    formatDate(end)
                ) +
                '&interval_in_minutes=' +
                intervalMinutes;


            const response =
                await provider.request(
                    path
                );


            if (
                !response ||
                response.status !==
                'SUCCESS'
            ) {

                throw new Error(
                    'Groww history request failed'
                );

            }


            const payload =
                response.payload || {};


            const rawCandles =
                Array.isArray(
                    payload.candles
                )

                ?

                payload.candles

                :

                [];


            const candles =
                rawCandles.map(
                    function(candle) {

                        return {

                            time:
                                candle[0],

                            open:
                                Number(
                                    candle[1]
                                ),

                            high:
                                Number(
                                    candle[2]
                                ),

                            low:
                                Number(
                                    candle[3]
                                ),

                            close:
                                Number(
                                    candle[4]
                                ),

                            volume:
                                Number(
                                    candle[5] || 0
                                )

                        };

                    }
                );


            return {

                symbol:
                    'NSE:' +
                    tradingSymbol,

                candles:
                    candles,

                timestamp:
                    Date.now()

            };

        }

};


module.exports =
    provider;
