'use strict';

const providers = {};


/* =========================================================
   REGISTER PROVIDER
   ========================================================= */

function registerProvider(provider) {

    if (!provider || !provider.name) {
        throw new Error('Invalid provider');
    }

    providers[provider.name] = provider;

}


/* =========================================================
   REMOVE PROVIDER
   ========================================================= */

function removeProvider(name) {

    delete providers[name];

}


/* =========================================================
   PROVIDER LIST
   ========================================================= */

function getProviders() {

    return Object.keys(providers);

}


/* =========================================================
   PROVIDER STATUS
   ========================================================= */

function getStatus() {

    return Object.keys(providers).map(
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


/* =========================================================
   MARKET DETECTION
   ========================================================= */

function detectMarket(symbol) {

    const value =
        String(symbol || '')
            .trim()
            .toUpperCase();


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


    if (
        value.indexOf('US:') === 0
    ) {

        return 'US';

    }


    const indianSymbols = [

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
        indianSymbols.indexOf(value) >= 0
    ) {

        return 'INDIA';

    }


    const forexSymbols = [

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
        forexSymbols.indexOf(value) >= 0
    ) {

        return 'FOREX';

    }


    return 'UNKNOWN';

}


/* =========================================================
   SYMBOL NORMALIZATION
   ========================================================= */

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


    /*
     * Already normalized.
     */

    if (
        value.indexOf('NSE:') === 0 ||
        value.indexOf('BSE:') === 0 ||
        value.indexOf('FX:') === 0 ||
        value.indexOf('US:') === 0
    ) {

        return value;

    }


    /*
     * Indian indices.
     */

    if (
        value === 'NIFTY50' ||
        value === 'NIFTY 50' ||
        value === 'NIFTY'
    ) {

        return 'NSE:NIFTY50';

    }


    if (
        value === 'BANKNIFTY' ||
        value === 'BANK NIFTY'
    ) {

        return 'NSE:BANKNIFTY';

    }


    /*
     * Forex.
     */

    const forexSymbols = [

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
        forexSymbols.indexOf(value) >= 0
    ) {

        return 'FX:' + value;

    }


    /*
     * Indian equities.
     */

    const indianSymbols = [

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
        indianSymbols.indexOf(value) >= 0
    ) {

        return 'NSE:' + value;

    }


    return value;

}


/* =========================================================
   FIND ELIGIBLE PROVIDERS
   ========================================================= */

function findProviders(
    symbol,
    operation
) {

    const normalized =
        normalizeSymbol(symbol);


    const market =
        detectMarket(normalized);


    const names =
        Object.keys(providers);


    const result = [];


    for (
        let i = 0;
        i < names.length;
        i++
    ) {

        const provider =
            providers[names[i]];


        if (
            !provider ||
            typeof provider.canHandle !==
            'function'
        ) {

            continue;

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
                'Provider eligibility error:',
                provider.name,
                error.message
            );

        }

    }


    return result;

}


/* =========================================================
   GENERIC FALLBACK EXECUTOR
   ========================================================= */

async function executeWithFallback(
    symbol,
    operation,
    methodName,
    args
) {

    const normalized =
        normalizeSymbol(symbol);


    const market =
        detectMarket(normalized);


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
                market,

            operation:
                operation,

            reason:
                'No eligible provider available'

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
            typeof provider[methodName] !==
            'function'
        ) {

            errors.push({

                provider:
                    provider.name,

                error:
                    methodName +
                    ' is not implemented'

            });

            continue;

        }


        try {

            const data =
                await provider[methodName]
                    .apply(
                        provider,
                        args
                    );


            /*
             * Provider may return
             * either raw data or a
             * structured response.
             */

            if (
                data &&
                data.success === false
            ) {

                errors.push({

                    provider:
                        provider.name,

                    error:
                        data.error ||
                        data.reason ||
                        'Provider rejected request'

                });

                continue;

            }


            return {

                success:
                    true,

                provider:
                    provider.name,

                market:
                    market,

                symbol:
                    normalized,

                data:
                    data

            };

        }
        catch(error) {

            console.error(

                provider.name +
                ' failed for ' +
                normalized +
                ':',

                error.message

            );


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

        market:
            market,

        operation:
            operation,

        errors:
            errors

    };

}


/* =========================================================
   PRICE
   ========================================================= */

async function getPrice(symbol) {

    return executeWithFallback(

        symbol,

        'price',

        'getPrice',

        [
            normalizeSymbol(symbol)
        ]

    );

}


/* =========================================================
   QUOTE
   ========================================================= */

async function getQuote(symbol) {

    return executeWithFallback(

        symbol,

        'quote',

        'getQuote',

        [
            normalizeSymbol(symbol)
        ]

    );

}


/* =========================================================
   HISTORY
   ========================================================= */

async function getHistory(
    symbol,
    interval,
    limit
) {

    return executeWithFallback(

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


/* =========================================================
   EXPORT
   ========================================================= */

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