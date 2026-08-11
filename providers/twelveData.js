'use strict';

const https = require('https');

const API_KEY =
    process.env.TWELVE_DATA_API_KEY || '';

const BASE_URL =
    'https://api.twelvedata.com';


/* =========================================================
   TWELVE DATA PROVIDER
   ========================================================= */

const provider = {

    name: 'twelveData',

    markets: [
        'US',
        'FOREX',
        'INDIA'
    ],

    capabilities: [
        'price',
        'quote',
        'history'
    ],


    /* =====================================================
       CAN HANDLE
       ===================================================== */

    canHandle: function(
        symbol,
        market,
        operation
    ) {

        /*
         * Keep provider registered for all markets,
         * but actual API entitlement is checked by
         * Twelve Data itself.
         */

        if (!API_KEY) {
            return false;
        }


        return (
            operation === 'price' ||
            operation === 'quote' ||
            operation === 'history'
        );

    },


    /* =====================================================
       HTTP REQUEST
       ===================================================== */

    request: function(path) {

        return new Promise(
            function(resolve, reject) {

                if (!API_KEY) {

                    reject(
                        new Error(
                            'TWELVE_DATA_API_KEY is missing'
                        )
                    );

                    return;
                }


                const separator =
                    path.indexOf('?') >= 0
                        ? '&'
                        : '?';


                const url =
                    BASE_URL +
                    path +
                    separator +
                    'apikey=' +
                    encodeURIComponent(
                        API_KEY
                    );


                const req =
                    https.get(
                        url,
                        {
                            headers: {
                                'User-Agent':
                                    'TraderAI/2.0'
                            }
                        },
                        function(res) {

                            let body = '';


                            res.on(
                                'data',
                                function(chunk) {

                                    body += chunk;

                                }
                            );


                            res.on(
                                'end',
                                function() {

                                    let data;

                                    try {

                                        data =
                                            JSON.parse(
                                                body
                                            );

                                    }
                                    catch(error) {

                                        reject(
                                            new Error(
                                                'Invalid Twelve Data response'
                                            )
                                        );

                                        return;

                                    }


                                    if (
                                        res.statusCode < 200 ||
                                        res.statusCode >= 300
                                    ) {

                                        reject(
                                            new Error(
                                                'Twelve Data HTTP ' +
                                                res.statusCode +
                                                ': ' +
                                                (
                                                    data.message ||
                                                    body
                                                )
                                            )
                                        );

                                        return;

                                    }


                                    if (
                                        data.status ===
                                        'error'
                                    ) {

                                        reject(
                                            new Error(
                                                data.message ||
                                                'Twelve Data API error'
                                            )
                                        );

                                        return;

                                    }


                                    resolve(
                                        data
                                    );

                                }
                            );

                        }
                    );


                req.setTimeout(
                    15000,
                    function() {

                        req.destroy();

                        reject(
                            new Error(
                                'Twelve Data request timeout'
                            )
                        );

                    }
                );


                req.on(
                    'error',
                    function(error) {

                        reject(error);

                    }
                );

            }
        );

    },


    /* =====================================================
       SYMBOL CONVERSION
       ===================================================== */

    toTwelveSymbol: function(
        symbol
    ) {

        let value =
            String(
                symbol || ''
            )
            .trim()
            .toUpperCase();


        /*
         * NSE format:
         *
         * NSE:RELIANCE
         * NSE:TCS
         *
         * Remove exchange prefix.
         */

        if (
            value.indexOf(
                'NSE:'
            ) === 0
        ) {

            value =
                value.substring(
                    4
                );

        }


        if (
            value.indexOf(
                'BSE:'
            ) === 0
        ) {

            value =
                value.substring(
                    4
                );

        }


        /*
         * Forex:
         *
         * FX:EURUSD
         * FX:GBPUSD
         */

        if (
            value.indexOf(
                'FX:'
            ) === 0
        ) {

            value =
                value.substring(
                    3
                );

        }


        /*
         * EUR/USD → EURUSD
         */

        value =
            value.replace(
                '/',
                ''
            );


        return value;

    },


    /* =====================================================
       PRICE
       ===================================================== */

    getPrice: async function(
        symbol
    ) {

        const converted =
            provider.toTwelveSymbol(
                symbol
            );


        const data =
            await provider.request(
                '/price?symbol=' +
                encodeURIComponent(
                    converted
                )
            );


        return {

            symbol:
                symbol,

            price:
                Number(
                    data.price
                ),

            timestamp:
                Date.now(),

            source:
                'Twelve Data'

        };

    },


    /* =====================================================
       QUOTE
       ===================================================== */

    getQuote: async function(
        symbol
    ) {

        const converted =
            provider.toTwelveSymbol(
                symbol
            );


        const data =
            await provider.request(
                '/quote?symbol=' +
                encodeURIComponent(
                    converted
                )
            );


        return {

            symbol:
                symbol,

            price:
                Number(
                    data.close
                ),

            open:
                Number(
                    data.open
                ),

            high:
                Number(
                    data.high
                ),

            low:
                Number(
                    data.low
                ),

            previousClose:
                Number(
                    data.previous_close
                ),

            change:
                Number(
                    data.change
                ),

            changePercent:
                Number(
                    data.percent_change
                ),

            volume:
                Number(
                    data.volume || 0
                ),

            datetime:
                data.datetime,

            timestamp:
                Date.now(),

            source:
                'Twelve Data'

        };

    },


    /* =====================================================
       HISTORY
       ===================================================== */

    getHistory: async function(
        symbol,
        interval,
        limit
    ) {

        const converted =
            provider.toTwelveSymbol(
                symbol
            );


        const allowedIntervals = [

            '1min',
            '5min',
            '15min',
            '30min',
            '45min',
            '1h',
            '2h',
            '4h',
            '8h',
            '1day',
            '1week',
            '1month'

        ];


        const selectedInterval =
            allowedIntervals.indexOf(
                interval
            ) >= 0
                ? interval
                : '1min';


        let size =
            Number(
                limit || 500
            );


        if (
            !Number.isFinite(size)
        ) {

            size = 500;

        }


        size =
            Math.max(
                1,
                Math.min(
                    size,
                    5000
                )
            );


        const data =
            await provider.request(
                '/time_series' +
                '?symbol=' +
                encodeURIComponent(
                    converted
                ) +
                '&interval=' +
                encodeURIComponent(
                    selectedInterval
                ) +
                '&outputsize=' +
                size +
                '&order=asc'
            );


        if (
            !Array.isArray(
                data.values
            )
        ) {

            throw new Error(
                'Twelve Data returned no candle data'
            );

        }


        const candles =
            data.values.map(
                function(item) {

                    return {

                        time:
                            item.datetime,

                        open:
                            Number(
                                item.open
                            ),

                        high:
                            Number(
                                item.high
                            ),

                        low:
                            Number(
                                item.low
                            ),

                        close:
                            Number(
                                item.close
                            ),

                        volume:
                            Number(
                                item.volume || 0
                            )

                    };

                }
            );


        return {

            symbol:
                symbol,

            interval:
                selectedInterval,

            candles:
                candles,

            timestamp:
                Date.now(),

            source:
                'Twelve Data'

        };

    }

};


module.exports = provider;
