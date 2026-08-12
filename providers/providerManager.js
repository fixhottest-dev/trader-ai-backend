'use strict';

const providers = {};


function registerProvider(provider) {

    if (
        !provider ||
        !provider.name
    ) {

        throw new Error(
            'Invalid provider'
        );

    }

    providers[
        provider.name
    ] = provider;

}


function removeProvider(name) {

    delete providers[name];

}


function getProviders() {

    return Object.keys(
        providers
    );

}


function getStatus() {

    return Object.keys(
        providers
    ).map(
        function(name) {

            const provider =
                providers[name];

            return {

                name:
                    provider.name,

                markets:
                    provider.markets || [],

                capabilities:
                    provider.capabilities || []

            };

        }
    );

}


function detectMarket(symbol) {

    const value =
        String(symbol || '')
            .toUpperCase()
            .trim();


    if (
        value.indexOf('NSE:') === 0 ||
        value.indexOf('BSE:') === 0
    ) {

        return 'INDIA';

    }


    if (
        value.indexOf('FX:') === 0
    ) {

        return 'FOREX';

    }


    const forex = [

        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'USDCHF',
        'AUDUSD',
        'USDCAD',
        'NZDUSD',
        'EURGBP',
        'EURJPY',
        'GBPJPY',
        'XAUUSD',
        'XAGUSD'

    ];


    if (
        forex.indexOf(value) >= 0
    ) {

        return 'FOREX';

    }


    const india = [

        'RELIANCE',
        'TCS',
        'INFY',
        'HDFCBANK',
        'ICICIBANK',
        'SBIN',
        'ITC',
        'LT',
        'AXISBANK',
        'KOTAKBANK',
        'BHARTIARTL',
        'MARUTI',
        'TATAMOTORS',
        'ADANIENT',
        'SUNPHARMA',
        'NIFTY',
        'BANKNIFTY',
        'FINNIFTY'

    ];


    if (
        india.indexOf(value) >= 0
    ) {

        return 'INDIA';

    }


    return 'UNKNOWN';

}


function normalizeSymbol(symbol) {

    let value =
        String(symbol || '')
            .trim()
            .toUpperCase();


    if (!value) {

        throw new Error(
            'Symbol is required'
        );

    }


    value =
        value.replace(
            /\//g,
            ''
        );


    if (
        value.indexOf('NSE:') === 0 ||
        value.indexOf('BSE:') === 0 ||
        value.indexOf('FX:') === 0
    ) {

        return value;

    }


    if (
        value === 'NIFTY' ||
        value === 'NIFTY50' ||
        value === 'NIFTY 50'
    ) {

        return 'NSE:NIFTY50';

    }


    if (
        value === 'BANKNIFTY' ||
        value === 'BANK NIFTY'
    ) {

        return 'NSE:BANKNIFTY';

    }


    const forex = [

        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'USDCHF',
        'AUDUSD',
        'USDCAD',
        'NZDUSD',
        'EURGBP',
        'EURJPY',
        'GBPJPY',
        'XAUUSD',
        'XAGUSD'

    ];


    if (
        forex.indexOf(value) >= 0
    ) {

        return 'FX:' + value;

    }


    const india = [

        'RELIANCE',
        'TCS',
        'INFY',
        'HDFCBANK',
        'ICICIBANK',
        'SBIN',
        'ITC',
        'LT',
        'AXISBANK',
        'KOTAKBANK',
        'BHARTIARTL',
        'MARUTI',
        'TATAMOTORS',
        'ADANIENT',
        'SUNPHARMA'

    ];


    if (
        india.indexOf(value) >= 0
    ) {

        return 'NSE:' + value;

    }


    return value;

}


function findProviders(
    symbol,
    operation
) {

    const normalized =
        normalizeSymbol(
            symbol
        );


    const market =
        detectMarket(
            normalized
        );


    const result = [];


    Object.keys(
        providers
    ).forEach(
        function(name) {

            const provider =
                providers[name];


            if (
                !provider ||
                typeof provider.canHandle !==
                'function'
            ) {

                return;

            }


            try {

                if (
                    provider.canHandle(
                        normalized,
                        market,
                        operation
                    )
                ) {

                    result.push(
                        provider
                    );

                }

            }
            catch(error) {

                console.error(
                    name +
                    ' eligibility error:',
                    error.message
                );

            }

        }
    );


    return result;

}


async function execute(
    symbol,
    operation,
    method,
    args
) {

    const normalized =
        normalizeSymbol(
            symbol
        );


    const candidates =
        findProviders(
            normalized,
            operation
        );


    if (
        candidates.length === 0
    ) {

        return {

            success:
                false,

            status:
                'unavailable',

            symbol:
                normalized,

            market:
                detectMarket(
                    normalized
                ),

            reason:
                'No eligible provider'

        };

    }


    const errors = [];


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const provider =
            candidates[i];


        if (
            typeof provider[method] !==
            'function'
        ) {

            continue;

        }


        try {

            const data =
                await provider[method]
                    .apply(
                        provider,
                        args
                    );


            return {

                success:
                    true,

                provider:
                    provider.name,

                symbol:
                    normalized,

                market:
                    detectMarket(
                        normalized
                    ),

                data:
                    data

            };

        }
        catch(error) {

            errors.push({

                provider:
                    provider.name,

                error:
                    error.message

            });

        }

    }


    return {

        success:
            false,

        status:
            'all_providers_failed',

        symbol:
            normalized,

        errors:
            errors

    };

}


async function getPrice(symbol) {

    return execute(

        symbol,

        'price',

        'getPrice',

        [
            normalizeSymbol(symbol)
        ]

    );

}


async function getQuote(symbol) {

    return execute(

        symbol,

        'quote',

        'getQuote',

        [
            normalizeSymbol(symbol)
        ]

    );

}


async function getHistory(
    symbol,
    interval,
    limit
) {

    return execute(

        symbol,

        'history',

        'getHistory',

        [
            normalizeSymbol(symbol),
            interval,
            limit
        ]

    );

}


module.exports = {

    registerProvider:
        registerProvider,

    removeProvider:
        removeProvider,

    getProviders:
        getProviders,

    getStatus:
        getStatus,

    detectMarket:
        detectMarket,

    normalizeSymbol:
        normalizeSymbol,

    findProviders:
        findProviders,

    getPrice:
        getPrice,

    getQuote:
        getQuote,

    getHistory:
        getHistory

};