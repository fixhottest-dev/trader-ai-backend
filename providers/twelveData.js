'use strict';

const https = require('https');


const provider = {

    name:
        'twelveData',

    markets: [
        'FOREX',
        'US'
    ],

    capabilities: [
        'price',
        'quote',
        'history'
    ],


    canHandle:
        function(symbol, market) {

            return (
                market === 'FOREX' ||
                market === 'US'
            );

        },


    request:
        function(path) {

            return new Promise(
                function(resolve, reject) {

                    const key =
                        process.env.TWELVE_DATA_API_KEY;


                    if (!key) {

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


                    const finalPath =
                        path +
                        separator +
                        'apikey=' +
                        encodeURIComponent(key);


                    const request =
                        https.get(

                            {
                                hostname:
                                    'api.twelvedata.com',

                                path:
                                    finalPath,

                                headers: {
                                    'Accept':
                                        'application/json'
                                }

                            },

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

                                        try {

                                            const data =
                                                JSON.parse(
                                                    body
                                                );


                                            if (
                                                response.statusCode < 200 ||
                                                response.statusCode >= 300
                                            ) {

                                                reject(

                                                    new Error(

                                                        'Twelve Data HTTP ' +
                                                        response.statusCode +
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
                                                data.status === 'error'
                                            ) {

                                                reject(

                                                    new Error(
                                                        data.message ||
                                                        'Twelve Data error'
                                                    )

                                                );

                                                return;

                                            }


                                            resolve(
                                                data
                                            );

                                        }
                                        catch(error) {

                                            reject(
                                                new Error(
                                                    'Invalid Twelve Data response'
                                                )
                                            );

                                        }

                                    }
                                );

                            }

                        );


                    request.on(
                        'error',
                        reject
                    );

                }
            );

        },


    normalize:
        function(symbol) {

            return String(symbol)
                .replace(
                    'FX:',
                    ''
                )
                .replace(
                    'US:',
                    ''
                )
                .toUpperCase();

        },


    getPrice:
        async function(symbol) {

            const value =
                provider.normalize(
                    symbol
                );


            const data =
                await provider.request(

                    '/price?symbol=' +
                    encodeURIComponent(
                        value
                    )

                );


            const price =
                Number(
                    data.price
                );


            if (
                !Number.isFinite(price)
            ) {

                throw new Error(
                    'Invalid price'
                );

            }


            return {

                symbol:
                    symbol,

                price:
                    price,

                timestamp:
                    Date.now()

            };

        },


    getQuote:
        async function(symbol) {

            const value =
                provider.normalize(
                    symbol
                );


            const data =
                await provider.request(

                    '/quote?symbol=' +
                    encodeURIComponent(
                        value
                    )

                );


            return {

                symbol:
                    symbol,

                quote:
                    data,

                timestamp:
                    Date.now()

            };

        },


    getHistory:
        async function(
            symbol,
            interval,
            limit
        ) {

            const value =
                provider.normalize(
                    symbol
                );


            const data =
                await provider.request(

                    '/time_series' +

                    '?symbol=' +
                    encodeURIComponent(
                        value
                    ) +

                    '&interval=' +
                    encodeURIComponent(
                        interval || '1min'
                    ) +

                    '&outputsize=' +
                    Math.max(
                        1,
                        Math.min(
                            Number(limit) || 500,
                            5000
                        )
                    )

                );


            const values =
                Array.isArray(
                    data.values
                )
                    ? data.values
                    : [];


            const candles =
                values
                    .map(
                        function(c) {

                            return {

                                time:
                                    c.datetime,

                                open:
                                    Number(c.open),

                                high:
                                    Number(c.high),

                                low:
                                    Number(c.low),

                                close:
                                    Number(c.close),

                                volume:
                                    Number(c.volume || 0)

                            };

                        }
                    )
                    .reverse();


            return {

                symbol:
                    symbol,

                candles:
                    candles,

                timestamp:
                    Date.now()

            };

        }

};


module.exports =
    provider;