"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomWebhookNftListing = exports.sendCustomWebhookRealEstate = exports.waitForTimeout = exports.getDateTime = void 0;
const axios_1 = __importDefault(require("axios"));
function getDateTime() {
    const date = new Date();
    const day = date.toLocaleDateString().replace(/\s/g, "");
    const hourNumber = date.getHours();
    const hourString = (hourNumber < 10 ? "0" : "") + hourNumber;
    const minNumber = date.getMinutes();
    const minString = (minNumber < 10 ? "0" : "") + minNumber;
    const secNumber = date.getSeconds();
    const secString = (secNumber < 10 ? "0" : "") + secNumber;
    const milliNumber = date.getMilliseconds();
    let milliString = milliNumber.toString();
    if (milliNumber < 10) {
        milliString = "00" + milliNumber;
    }
    else if (milliNumber < 100) {
        milliString = "0" + milliNumber;
    }
    return (day +
        " " +
        hourString +
        ":" +
        minString +
        ":" +
        secString +
        ":" +
        milliString);
}
exports.getDateTime = getDateTime;
function waitForTimeout(milliseconds) {
    return new Promise((r) => setTimeout(r, milliseconds));
}
exports.waitForTimeout = waitForTimeout;
function sendCustomWebhookRealEstate(item, WEBHOOK_URL, status, INTERVAL = 1000) {
    return new Promise((resolve, reject) => {
        const oldPrice = status === "Price change"
            ? {
                name: "Old price",
                value: `${item.priceHistory[item.priceHistory.length - 2].toLocaleString()} Kč`,
                inline: true,
            }
            : {
                name: "\u200b",
                value: "\u200b",
                inline: true,
            };
        axios_1.default
            .post(WEBHOOK_URL, {
            embeds: [
                {
                    author: {
                        name: `${item.location}`,
                    },
                    title: `${item.name}`,
                    url: `${item.url}`,
                    fields: [
                        {
                            name: "Price",
                            value: `${item.price.toLocaleString()} Kč`,
                            inline: true,
                        },
                        {
                            name: "Status",
                            value: status,
                            inline: true,
                        },
                        oldPrice,
                    ],
                    image: {
                        url: `${item.images[0]}`,
                    },
                    color: "59110",
                    timestamp: new Date().toISOString(),
                },
            ],
        }, {
            timeout: 4000,
            validateStatus: () => true,
        })
            .then((res) => {
            if (res.status === 204) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][SUCCESS]`);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
            else if (res.status === 400) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][BAD REQUEST]`);
                resolve();
            }
            else if (res.status === 401) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][INVALID URL]`);
                resolve();
            }
            else if (res.status === 429) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][RATE LIMIT]`);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
            else {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][FAILED][${res.status} - ${res.statusText}]`);
                console.log(res.data);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
        });
    }).catch((error) => {
        console.log(`[${getDateTime()}][CUSTOM WEBHOOK][REAL ESTATE][CRASH]`);
        if (error.message.includes("timeout") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ETIMEDOUT") ||
            error.message.includes("ECONNRESET") ||
            error.message.includes("aborted")) {
        }
        else {
            console.log(error);
        }
        sendCustomWebhookRealEstate(item, WEBHOOK_URL, status, INTERVAL);
    });
}
exports.sendCustomWebhookRealEstate = sendCustomWebhookRealEstate;
function sendCustomWebhookNftListing(item, WEBHOOK_URL, INTERVAL = 1000) {
    return new Promise((resolve, reject) => {
        axios_1.default
            .post(WEBHOOK_URL, {
            embeds: [
                {
                    author: {
                        name: `NEW LISTING`,
                    },
                    title: `${item.name}`,
                    url: `${item.marketUrl}`,
                    fields: [
                        {
                            name: "Price",
                            value: `${(item.currentEthPrice / Math.pow(10, 18))
                                .toString()
                                .slice(0, 5)} Ξ`,
                            inline: true,
                        },
                        {
                            name: "Rarity",
                            value: `${item.rarityScore}`,
                            inline: true,
                        },
                        {
                            name: "Marketplace",
                            value: `${item.market}`.toUpperCase(),
                            inline: true,
                        },
                    ],
                    image: {
                        url: `${item.smallImageUrl}`,
                    },
                    color: "59110",
                    timestamp: new Date().toISOString(),
                },
            ],
        }, {
            timeout: 4000,
            validateStatus: () => true,
        })
            .then((res) => {
            if (res.status === 204) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][SUCCESS]`);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
            else if (res.status === 400) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][BAD REQUEST]`);
                resolve();
            }
            else if (res.status === 401) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][INVALID URL]`);
                resolve();
            }
            else if (res.status === 429) {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][RATE LIMIT]`);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
            else {
                console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][FAILED][${res.status} - ${res.statusText}]`);
                console.log(res.data);
                setTimeout(() => {
                    resolve();
                }, INTERVAL);
            }
        });
    }).catch((error) => {
        console.log(`[${getDateTime()}][CUSTOM WEBHOOK][NFT LISTING][CRASH]`);
        if (error.message.includes("timeout") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ETIMEDOUT") ||
            error.message.includes("ECONNRESET") ||
            error.message.includes("aborted")) {
        }
        else {
            console.log(error);
        }
        sendCustomWebhookNftListing(item, WEBHOOK_URL, INTERVAL);
    });
}
exports.sendCustomWebhookNftListing = sendCustomWebhookNftListing;
