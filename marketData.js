'use strict';

const https = require('https');

const API_KEY =
    process.env.TWELVE_DATA_API_KEY || '';

const BASE_URL =
    'https://api.twelvedata.com';


/* =========================================================
   SYMBOL MAP
   ========================================================= */

const SYMBOLS = {

    RELIANCE:
        {
            symbol: 'RELIANCE',
            exchange: 'NSE'
        },

    TCS:
        {
            symbol: 'TCS',
            exchange: 'NSE'
        },

    INFY:
        {
            symbol: 'INFY',
            exchange: 'NSE'
        },

    HDFCBANK:
        {
            symbol: 'HDFCBANK',
            exchange: 'NSE'
        },

    ICICIBANK:
        {
            symbol: 'ICICIBANK',
            exchange: 'NSE'
        },

    SBIN:
        {
            symbol: 'SBIN',
            exchange: 'NSE'
        },

    NIFTY:
        {
            symbol: 'NIFTY 50',
            exchange: 'NSE'
        },

    BANKNIFTY:
        {
            symbol: 'NIFTY BANK',
            exchange: 'NSE'
        }

};


/* =========================================================
   HTTP REQUEST
   ========================================================= */

function request(path) {

    return new Promise(
        function(resolve, reject) {

            if (!API_KEY) {

                reject(
                    new Error(
                        'TWELVE_DATA_API_KEY is not configured'
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
                                'TraderAI/1.0'
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

                                if (
                                    res.statusCode < 200 ||
                                    res.statusCode >= 300
                                ) {

                                    reject(
                                        new Error(
                                            'Market API HTTP ' +
                                            res.statusCode +
                                            ': ' +
                                            body
                                        )
                                    );

                                    return;
                                }


                                try {

                                    const data =
                                        JSON.parse(
                                            body
                                        );


                                    if (
                                        data.status ===
                                        'error'
                                    ) {

                                        reject(
                                            new Error(
                                                data.message ||
                                                'Market API error'
                                            )
                                        );

                                        return;
                                    }


                                    resolve(data);

                                }
                                catch(error) {

                                    reject(
                                        new Error(
                                            'Invalid market API response'
                                        )
                                    );

                                }

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
                            'Market API timeout'
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

}


/* =========================================================
   SYMBOL RESOLUTION
   ========================================================= */

function resolveSymbol(
    symbol
) {

    const key =
        String(
            symbol || ''
        )
        .trim()
        .toUpperCase();


    return SYMBOLS[key] || null;
}


/* =========================================================
   LATEST PRICE
   ========================================================= */

async function getPrice(
    symbol
) {

    const info =
        resolveSymbol(
            symbol
        );


    if (!info) {

        throw new Error(
            'Unsupported symbol: ' +
            symbol
        );
    }


    const query =
        '/price?' +
        'symbol=' +
        encodeURIComponent(
            info.symbol
        ) +
        '&exchange=' +
        encodeURIComponent(
            info.exchange
        );


    const data =
        await request(
            query
        );


    return {

        symbol:
            String(symbol).toUpperCase(),

        exchange:
            info.exchange,

        price:
            Number(
                data.price
            ),

        timestamp:
            Date.now(),

        source:
            'Twelve Data'

    };

}


/* =========================================================
   HISTORICAL CANDLES
   ========================================================= */

async function getHistory(
    symbol,
    interval,
    outputsize
) {

    const info =
        resolveSymbol(
            symbol
        );


    if (!info) {

        throw new Error(
            'Unsupported symbol: ' +
            symbol
        );
    }


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
            outputsize || 500
        );


    if (!Number.isFinite(size)) {

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


    const query =
        '/time_series?' +
        'symbol=' +
        encodeURIComponent(
            info.symbol
        ) +
        '&exchange=' +
        encodeURIComponent(
            info.exchange
        ) +
        '&interval=' +
        encodeURIComponent(
            selectedInterval
        ) +
        '&outputsize=' +
        size +
        '&order=asc';


    const data =
        await request(
            query
        );


    if (
        !Array.isArray(
            data.values
        )
    ) {

        throw new Error(
            'No candle data returned'
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
            String(symbol).toUpperCase(),

        exchange:
            info.exchange,

        interval:
            selectedInterval,

        candles:
            candles,

        source:
            'Twelve Data',

        timestamp:
            Date.now()

    };

}


/* =========================================================
   MARKET QUOTE
   ========================================================= */

async function getQuote(
    symbol
) {

    const info =
        resolveSymbol(
            symbol
        );


    if (!info) {

        throw new Error(
            'Unsupported symbol: ' +
            symbol
        );
    }


    const query =
        '/quote?' +
        'symbol=' +
        encodeURIComponent(
            info.symbol
        ) +
        '&exchange=' +
        encodeURIComponent(
            info.exchange
        );


    const data =
        await request(
            query
        );


    return {

        symbol:
            String(symbol).toUpperCase(),

        exchange:
            info.exchange,

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

}


/* =========================================================
   EXPORT
   ========================================================= */

module.exports = {

    resolveSymbol:
        resolveSymbol,

    getPrice:
        getPrice,

    getHistory:
        getHistory,

    getQuote:
        getQuote

};
