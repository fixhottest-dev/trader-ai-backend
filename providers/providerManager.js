'use strict';


/* =========================================================
   TRADER AI — UNIVERSAL PROVIDER MANAGER
   =========================================================
   
   Purpose:
   - Detect market type from symbol
   - Select suitable provider
   - Support multiple providers
   - Keep provider logic outside the AI engine
   ========================================================= */


/* =========================================================
   PROVIDER REGISTRY
   ========================================================= */

const providers = {};


/* =========================================================
   REGISTER PROVIDER
   ========================================================= */

function registerProvider(
    provider
) {

    if (!provider) {
        throw new Error(
            'Provider is required'
        );
    }


    if (!provider.name) {
        throw new Error(
            'Provider name is required'
        );
    }


    if (
        typeof provider.canHandle !==
        'function'
    ) {

        throw new Error(
            'Provider must implement canHandle()'
        );

    }


    providers[
        provider.name
    ] = provider;

}


/* =========================================================
   REMOVE PROVIDER
   ========================================================= */

function removeProvider(
    name
) {

    delete providers[name];

}


/* =========================================================
   GET PROVIDERS
   ========================================================= */

function getProviders() {

    return Object.keys(
        providers
    );

}


/* =========================================================
   MARKET TYPE DETECTION
   ========================================================= */

function detectMarket(
    symbol
) {

    const value =
        String(
            symbol || ''
        )
        .trim()
        .toUpperCase();


    /*
     * Explicit universal format:
     *
     * NSE:RELIANCE
     * BSE:TCS
     * FX:EURUSD
     * US:AAPL
     */

    if (
        value.indexOf(
            'NSE:'
        ) === 0
    ) {

        return 'INDIA';

    }


    if (
        value.indexOf(
            'BSE:'
        ) === 0
    ) {

        return 'INDIA';

    }


    if (
        value.indexOf(
            'FX:'
        ) === 0
    ) {

        return 'FOREX';

    }


    if (
        value.indexOf(
            'US:'
        ) === 0
    ) {

        return 'US';

    }


    /*
     * Common Indian symbols.
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
        'BHARTIARTL',
        'AXISBANK',
        'KOTAKBANK',
        'MARUTI',
        'TATAMOTORS',
        'ADANIENT',
        'SUNPHARMA',
        'NIFTY',
        'BANKNIFTY',
        'FINNIFTY'

    ];


    if (
        indianSymbols.indexOf(
            value
        ) >= 0
    ) {

        return 'INDIA';

    }


    /*
     * Forex pair detection.
     *
     * EURUSD
     * GBPUSD
     * USDJPY
     * AUDUSD
     * USDCHF
     */

    const forexPairs = [

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
        'AUDJPY',
        'EURAUD',
        'EURCHF',
        'XAUUSD',
        'XAGUSD'

    ];


    if (
        forexPairs.indexOf(
            value
        ) >= 0
    ) {

        return 'FOREX';

    }


    /*
     * Default.
     */

    return 'UNKNOWN';

}


/* =========================================================
   NORMALIZE SYMBOL
   ========================================================= */

function normalizeSymbol(
    symbol
) {

    let value =
        String(
            symbol || ''
        )
        .trim()
        .toUpperCase();


    if (!value) {

        throw new Error(
            'Symbol is required'
        );

    }


    /*
     * Convert common user formats.
     */

    if (
        value === 'NIFTY50' ||
        value === 'NIFTY 50'
    ) {

        value =
            'NSE:NIFTY50';

    }


    if (
        value === 'BANK NIFTY' ||
        value === 'BANKNIFTY'
    ) {

        value =
            'NSE:BANKNIFTY';

    }


    if (
        value.indexOf(
            '/'
        ) > 0
    ) {

        value =
            value.replace(
                '/',
                ''
            );

    }


    /*
     * EUR/USD → FX:EURUSD
     */

    const possibleForex =
        [

            'EURUSD',
            'GBPUSD',
            'USDJPY',
            'USDCHF',
            'AUDUSD',
            'USDCAD',
            'NZDUSD',
            'EURGBP',
            'EURJPY',
            'GBPJPY'

        ];


    if (
        possibleForex.indexOf(
            value
        ) >= 0
    ) {

        value =
            'FX:' +
            value;

    }


    /*
     * Known Indian stocks.
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
        'BHARTIARTL',
        'AXISBANK',
        'KOTAKBANK',
        'MARUTI',
        'TATAMOTORS',
        'ADANIENT',
        'SUNPHARMA'

    ];


    if (
        indianSymbols.indexOf(
            value
        ) >= 0
    ) {

        value =
            'NSE:' +
            value;

    }


    return value;

}


/* =========================================================
   FIND PROVIDER
   ========================================================= */

function findProvider(
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


    const names =
        Object.keys(
            providers
        );


    for (
        let i = 0;
        i < names.length;
        i++
    ) {

        const provider =
            providers[
                names[i]
            ];


        try {

            if (
                provider.canHandle(
                    normalized,
                    market,
                    operation
                )
            ) {

                return provider;

            }

        }
        catch(error) {

            console.error(
                'Provider check failed:',
                provider.name,
                error.message
            );

        }

    }


    return null;

}


/* =========================================================
   GET PRICE
   ========================================================= */

async function getPrice(
    symbol
) {

    const normalized =
        normalizeSymbol(
            symbol
        );


    const provider =
        findProvider(
            normalized,
            'price'
        );


    if (!provider) {

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
                'No eligible market-data provider'

        };

    }


    const result =
        await provider.getPrice(
            normalized
        );


    return {

        success:
            true,

        provider:
            provider.name,

        market:
            detectMarket(
                normalized
            ),

        data:
            result

    };

}


/* =========================================================
   GET HISTORY
   ========================================================= */

async function getHistory(
    symbol,
    interval,
    limit
) {

    const normalized =
        normalizeSymbol(
            symbol
        );


    const provider =
        findProvider(
            normalized,
            'history'
        );


    if (!provider) {

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
                'No eligible historical-data provider'

        };

    }


    const result =
        await provider.getHistory(
            normalized,
            interval,
            limit
        );


    return {

        success:
            true,

        provider:
            provider.name,

        market:
            detectMarket(
                normalized
            ),

        data:
            result

    };

}


/* =========================================================
   GET QUOTE
   ========================================================= */

async function getQuote(
    symbol
) {

    const normalized =
        normalizeSymbol(
            symbol
        );


    const provider =
        findProvider(
            normalized,
            'quote'
        );


    if (!provider) {

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
                'No eligible quote provider'

        };

    }


    const result =
        await provider.getQuote(
            normalized
        );


    return {

        success:
            true,

        provider:
            provider.name,

        market:
            detectMarket(
                normalized
            ),

        data:
            result

    };

}


/* =========================================================
   PROVIDER STATUS
   ========================================================= */

function getStatus() {

    const list =
        Object.keys(
            providers
        );


    return list.map(
        function(name) {

            const provider =
                providers[name];


            return {

                name:
                    provider.name,

                markets:
                    provider.markets ||
                    [],

                capabilities:
                    provider.capabilities ||
                    []

            };

        }
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

    findProvider:
        findProvider,

    getPrice:
        getPrice,

    getHistory:
        getHistory,

    getQuote:
        getQuote

};
