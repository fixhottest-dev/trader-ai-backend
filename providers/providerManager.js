'use strict';

const providers = {};


/* =========================================================
   REGISTER
   ========================================================= */

function registerProvider(provider) {

    if (!provider || !provider.name) {
        throw new Error('Invalid provider');
    }

    providers[provider.name] = provider;
}


/* =========================================================
   REMOVE
   ========================================================= */

function removeProvider(name) {

    delete providers[name];

}


/* =========================================================
   LIST
   ========================================================= */

function getProviders() {

    return Object.keys(providers);

}


/* =========================================================
   MARKET DETECTION
   ========================================================= */

function detectMarket(symbol) {

    const value =
        String(symbol || '')
        .trim()
        .toUpperCase();


    if (value.indexOf('NSE:') === 0) {
        return 'INDIA';
    }

    if (value.indexOf('BSE:') === 0) {
        return 'INDIA';
    }

    if (value.indexOf('FX:') === 0) {
        return 'FOREX';
    }

    if (value.indexOf('US:') === 0) {
        return 'US';
    }


    const indian = [

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
        indian.indexOf(value) >= 0
    ) {
        return 'INDIA';
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


    return 'UNKNOWN';
}


/* =========================================================
   NORMALIZE
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


    if (
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


    if (
        value.indexOf('/') > 0
    ) {

        value =
            value.replace(/\//g, '');

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


    const indian = [

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
        indian.indexOf(value) >= 0
    ) {

        return 'NSE:' + value;

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
        normalizeSymbol(symbol);

    const market =
        detectMarket(normalized);

    const names =
        Object.keys(providers);


    for (
        let i = 0;
        i < names.length;
        i++
    ) {

        const provider =
            providers[names[i]];


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

        } catch (error) {

            console.error(
                'Provider check error:',
                provider.name,
                error.message
            );

        }

    }


    return null;
}


/* =========================================================
   PRICE
   ========================================================= */

async function getPrice(symbol) {

    const normalized =
        normalizeSymbol(symbol);


    const provider =
        findProvider(
            normalized,
            'price'
        );


    if (!provider) {

        return {

            success: false,

            status: 'unavailable',

            symbol: normalized,

            market:
                detectMarket(normalized),

            reason:
                'No eligible market-data provider'

        };

    }


    try {

        const data =
            await provider.getPrice(
                normalized
            );


        return {

            success: true,

            provider:
                provider.name,

            market:
                detectMarket(normalized),

            data: data

        };

    } catch (error) {

        return {

            success: false,

            status: 'provider_error',

            provider:
                provider.name,

            symbol:
                normalized,

            error:
                error.message

        };

    }
}


/* =========================================================
   HISTORY
   ========================================================= */

async function getHistory(
    symbol,
    interval,
    limit
) {

    const normalized =
        normalizeSymbol(symbol);


    const provider =
        findProvider(
            normalized,
            'history'
        );


    if (!provider) {

        return {

            success: false,

            status: 'unavailable',

            symbol: normalized,

            market:
                detectMarket(normalized),

            reason:
                'No eligible historical-data provider'

        };

    }


    try {

        const data =
            await provider.getHistory(
                normalized,
                interval,
                limit
            );


        return {

            success: true,

            provider:
                provider.name,

            market:
                detectMarket(normalized),

            data: data

        };

    } catch (error) {

        return {

            success: false,

            status: 'provider_error',

            provider:
                provider.name,

            symbol:
                normalized,

            error:
                error.message

        };

    }
}


/* =========================================================
   QUOTE
   ========================================================= */

async function getQuote(symbol) {

    const normalized =
        normalizeSymbol(symbol);


    const provider =
        findProvider(
            normalized,
            'quote'
        );


    if (!provider) {

        return {

            success: false,

            status: 'unavailable',

            symbol: normalized,

            market:
                detectMarket(normalized),

            reason:
                'No eligible quote provider'

        };

    }


    try {

        const data =
            await provider.getQuote(
                normalized
            );


        return {

            success: true,

            provider:
                provider.name,

            market:
                detectMarket(normalized),

            data: data

        };

    } catch (error) {

        return {

            success: false,

            status: 'provider_error',

            provider:
                provider.name,

            symbol:
                normalized,

            error:
                error.message

        };

    }
}


/* =========================================================
   STATUS
   ========================================================= */

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
