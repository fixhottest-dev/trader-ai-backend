const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const wss = new WebSocket.Server({
    server: server
});

const PORT = process.env.PORT || 3000;


/* =========================================================
   SYMBOL DATABASE
   ========================================================= */

const START_PRICES = {
    RELIANCE: 1482.30,
    TCS: 3845.50,
    INFY: 1764.20,
    HDFCBANK: 1924.80,
    ICICIBANK: 1421.10,
    SBIN: 824.40,
    NIFTY: 24500.00,
    BANKNIFTY: 55500.00
};


/* =========================================================
   MARKET STATE
   ========================================================= */

const market = {};

Object.keys(START_PRICES).forEach(function(symbol) {

    const price = START_PRICES[symbol];

    market[symbol] = {

        symbol: symbol,

        price: price,

        previousClose: price,

        open: price,

        high: price,

        low: price,

        volume: 0,

        timestamp: Date.now(),

        change: 0,

        changePercent: 0,

        candles: []

    };

});


/* =========================================================
   HELPERS
   ========================================================= */

function round(value, decimals) {

    const factor = Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


/* =========================================================
   DEMO MARKET TICK
   ========================================================= */

function updateMarket() {

    Object.keys(market).forEach(function(symbol) {

        const item = market[symbol];

        /*
         * DEMO ONLY.
         *
         * This is NOT real market data.
         */

        const volatility =
            symbol === "NIFTY" ||
            symbol === "BANKNIFTY"
                ? 0.0005
                : 0.0012;


        let movement =
            (Math.random() - 0.5)
            * volatility;


        /*
         * Occasional stronger movement.
         */

        if (Math.random() < 0.03) {

            movement *= 4;

        }


        item.price +=
            item.price * movement;


        item.price =
            round(item.price, 2);


        item.high =
            Math.max(
                item.high,
                item.price
            );


        item.low =
            Math.min(
                item.low,
                item.price
            );


        item.volume +=
            Math.floor(
                100 +
                Math.random() * 5000
            );


        item.change =
            round(
                item.price -
                item.previousClose,
                2
            );


        item.changePercent =
            round(
                (
                    item.change /
                    item.previousClose
                ) * 100,
                2
            );


        item.timestamp =
            Date.now();

    });


    broadcastMarket();

}


/* =========================================================
   CANDLE CREATION
   ========================================================= */

function createCandles() {

    Object.keys(market).forEach(function(symbol) {

        const item = market[symbol];


        const candle = {

            time: Date.now(),

            open: item.open,

            high: item.high,

            low: item.low,

            close: item.price,

            volume: item.volume

        };


        item.candles.push(candle);


        /*
         * Keep maximum 500 candles.
         */

        if (item.candles.length > 500) {

            item.candles.shift();

        }


        /*
         * New candle starts.
         */

        item.open =
            item.price;

        item.high =
            item.price;

        item.low =
            item.price;

        item.volume = 0;

    });

}


/* =========================================================
   BROADCAST
   ========================================================= */

function broadcastMarket() {

    const packet = JSON.stringify({

        type: "MARKET_UPDATE",

        timestamp: Date.now(),

        instruments: market

    });


    wss.clients.forEach(function(client) {

        if (
            client.readyState ===
            WebSocket.OPEN
        ) {

            client.send(packet);

        }

    });

}


/* =========================================================
   WEBSOCKET
   ========================================================= */

wss.on(
    "connection",
    function(ws) {

        console.log(
            "Trader AI client connected"
        );


        ws.send(
            JSON.stringify({

                type: "CONNECTED",

                timestamp: Date.now(),

                message:
                    "Trader AI realtime engine online"

            })
        );


        /*
         * Initial snapshot.
         */

        ws.send(
            JSON.stringify({

                type: "MARKET_SNAPSHOT",

                timestamp: Date.now(),

                instruments: market

            })
        );


        ws.on(
            "message",
            function(raw) {

                try {

                    const request =
                        JSON.parse(
                            raw.toString()
                        );


                    /* =========================
                       SUBSCRIBE
                    ========================== */

                    if (
                        request.type ===
                        "SUBSCRIBE"
                    ) {

                        const symbol =
                            String(
                                request.symbol || ""
                            ).toUpperCase();


                        if (
                            market[symbol]
                        ) {

                            ws.send(
                                JSON.stringify({

                                    type:
                                        "SUBSCRIBED",

                                    symbol:
                                        symbol,

                                    data:
                                        market[symbol]

                                })
                            );

                        }
                        else {

                            ws.send(
                                JSON.stringify({

                                    type:
                                        "ERROR",

                                    message:
                                        "Unknown symbol"

                                })
                            );

                        }

                    }


                    /* =========================
                       HISTORY
                    ========================== */

                    if (
                        request.type ===
                        "GET_HISTORY"
                    ) {

                        const symbol =
                            String(
                                request.symbol || ""
                            ).toUpperCase();


                        let limit =
                            Number(
                                request.limit || 100
                            );


                        limit =
                            clamp(
                                limit,
                                1,
                                500
                            );


                        if (
                            market[symbol]
                        ) {

                            ws.send(
                                JSON.stringify({

                                    type:
                                        "HISTORY",

                                    symbol:
                                        symbol,

                                    candles:
                                        market[symbol]
                                        .candles
                                        .slice(-limit)

                                })
                            );

                        }

                    }


                    /* =========================
                       PING
                    ========================== */

                    if (
                        request.type ===
                        "PING"
                    ) {

                        ws.send(
                            JSON.stringify({

                                type:
                                    "PONG",

                                timestamp:
                                    Date.now()

                            })
                        );

                    }

                }
                catch(error) {

                    ws.send(
                        JSON.stringify({

                            type:
                                "ERROR",

                            message:
                                "Invalid request"

                        })
                    );

                }

            }
        );


        ws.on(
            "close",
            function() {

                console.log(
                    "Trader AI client disconnected"
                );

            }
        );

    }
);


/* =========================================================
   REST
   ========================================================= */

app.get(
    "/",
    function(req, res) {

        res.json({

            app:
                "Trader AI",

            status:
                "online",

            version:
                "1.0.0",

            websocket:
                "enabled",

            mode:
                "DEMO"

        });

    }
);


app.get(
    "/api/market",
    function(req, res) {

        res.json({

            type:
                "MARKET_SNAPSHOT",

            timestamp:
                Date.now(),

            instruments:
                market

        });

    }
);


app.get(
    "/api/market/:symbol",
    function(req, res) {

        const symbol =
            req.params.symbol.toUpperCase();


        if (
            !market[symbol]
        ) {

            return res
                .status(404)
                .json({

                    error:
                        "Instrument not found"

                });

        }


        res.json(
            market[symbol]
        );

    }
);


/* =========================================================
   CLOCKS
   ========================================================= */

/*
 * Price tick:
 * every 1 second
 */

setInterval(
    function() {

        updateMarket();

    },
    1000
);


/*
 * Demo candle:
 * every 5 seconds
 */

setInterval(
    function() {

        createCandles();

    },
    5000
);


/* =========================================================
   SERVER
   ========================================================= */

server.listen(
    PORT,
    function() {

        console.log(
            "Trader AI listening on port " +
            PORT
        );

    }
);
