"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const mongoose_1 = __importDefault(require("mongoose"));
const user_agents_1 = __importDefault(require("user-agents"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("../database");
const utils_1 = require("../utils");
const TIMEOUT = 60000;
function monitor(pages) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect(process.env.MONGO_URI);
        }
        catch (e) {
            console.log(`[${(0, utils_1.getDateTime)()}][MONITOR][DB][ERROR]`);
            console.log(e);
            throw e;
        }
        console.log(`[${(0, utils_1.getDateTime)()}][MONITOR][DB][CONNECTED]`);
        for (const pg of pages) {
            try {
                const { newUnparsedListings, updatedListings } = yield getListings(pg);
                const latestListings = {
                    updatedListings: updatedListings,
                    newListings: [],
                };
                if (newUnparsedListings.length) {
                    const newListings = yield checkPage(pg, newUnparsedListings);
                    latestListings.newListings = newListings;
                }
                return latestListings;
            }
            catch (e) {
                yield mongoose_1.default.connection.close();
                console.log(`[${(0, utils_1.getDateTime)()}][MONITOR][DB][END]`);
                throw e;
            }
        }
        //console.dir(scrapedListings, { maxArrayLength: null });
        yield mongoose_1.default.connection.close();
        console.log(`[${(0, utils_1.getDateTime)()}][MONITOR][DB][END]`);
    });
}
exports.default = monitor;
function getListings(pg) {
    return new Promise(function cb(resolve, reject) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const browser = yield puppeteer_extra_1.default.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            const page = yield browser.newPage();
            page.setDefaultTimeout(TIMEOUT);
            yield page.setCacheEnabled(false);
            const client = yield page.target().createCDPSession();
            yield client.send("Network.clearBrowserCookies");
            const ua = new user_agents_1.default();
            yield page.setUserAgent(ua.data.userAgent);
            yield page.setViewport({
                width: ua.data.viewportWidth,
                height: ua.data.viewportHeight,
            });
            yield page.setRequestInterception(true);
            page.on("request", (request) => {
                if (["font", "stylesheet", "media", "image"].includes(request.resourceType())) {
                    request.abort();
                }
                else {
                    request.continue();
                }
            });
            yield page.goto(pg.url, {
                waitUntil: "networkidle2",
            });
            let scrapedListings = [];
            let isBtnDisabled = false;
            let pageNumber = 1;
            let retriesMonitor = 3;
            while (!isBtnDisabled) {
                try {
                    yield page.waitForFunction(() => !!document.querySelector("div.property"));
                    const currentAdsOnOnePage = yield page.evaluate((type) => {
                        const currentAdsOnOnePage = [];
                        const ads = document.querySelectorAll("div.property");
                        for (const ad of ads) {
                            const price = ad.querySelector("div.text-wrap > span.basic > span.price").innerText
                                .replace("Kč", "")
                                .replace(/\s/g, "");
                            const location = ad.querySelector("div.text-wrap > span.basic > span.locality").innerText;
                            const name = ad.querySelector("div.text-wrap > span.basic > h2 > a > span.name").innerText;
                            const url = ad.querySelector("div.text-wrap > span.basic > h2 > a").href;
                            const basicInfo = {
                                location: location,
                                price: !isNaN(Number(price)) ? Number(price) : 0,
                                name: name,
                                url: url,
                                type: type,
                            };
                            currentAdsOnOnePage.push(basicInfo);
                        }
                        return currentAdsOnOnePage;
                    }, pg.type);
                    scrapedListings = scrapedListings.concat(currentAdsOnOnePage);
                    console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][PAGE NUMBER: ${pageNumber}] `);
                    yield page.waitForFunction(() => !!document.querySelector("div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next"));
                    const isDisabled = (yield page.$("div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next.disabled")) !== null;
                    isBtnDisabled = isDisabled;
                    if (!isDisabled) {
                        yield Promise.all([
                            page.evaluate(() => {
                                document.querySelector("div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next").click();
                            }),
                            page.waitForNavigation({ waitUntil: "networkidle2" }),
                        ]);
                        pageNumber++;
                    }
                }
                catch (error) {
                    if (error.name.includes("TimeoutError") ||
                        error.name.includes("ERR_CONNECTION_RESET") ||
                        error.name.includes("ERR_CONNECTION_CLOSED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][ERROR][POOR CONNECTION] `);
                    }
                    else if (error.name.includes("ERR_INTERNET_DISCONNECTED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][ERROR][NO CONNECTION]`);
                    }
                    else if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][ERROR][WRONG URL ADRRESS]`);
                        yield browser.close();
                        return reject(new Error("WRONG URL ADRRESS"));
                    }
                    else if (error.message.includes("Session closed. Most likely the page has been closed") ||
                        error.message.includes("Navigation failed because browser has disconnected!")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][ERROR][BROWSER HAS BEEN CLOSED]`);
                        yield browser.close();
                        return cb(resolve, reject);
                    }
                    else {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][ERROR]`);
                        console.log(error);
                    }
                    retriesMonitor--;
                    if (retriesMonitor === 0) {
                        console.log(`[${(0, utils_1.getDateTime)()}][GET LISTINGS][ERROR][FAILED TO MANY TIMES]`);
                        yield browser.close();
                        return cb(resolve, reject);
                    }
                }
            }
            yield browser.close();
            scrapedListings = scrapedListings.filter((ad, index, self) => index === self.findIndex((obj) => obj.url === ad.url));
            const users = yield database_1.User.find({});
            const newUnparsedListings = [];
            const updatedListings = [];
            for (const ad of scrapedListings) {
                const result = yield database_1.RealEstate.findOne({ url: ad.url });
                if (result) {
                    //PRICE CHANGE
                    if (result.price !== ad.price) {
                        if (ad.price === result.priceHistory[result.priceHistory.length - 2]) {
                            console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][PRICE CHANGE][CACHE][${ad.url}]`);
                        }
                        else {
                            console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][PRICE CHANGE][${ad.url}][OLD: ${result.price}][NEW: ${ad.price}]`);
                            result.price = ad.price;
                            result.priceHistory.push(ad.price);
                            yield result.save();
                            updatedListings.push(result);
                            if (users) {
                                for (const user of users) {
                                    for (const notification of user.notifications) {
                                        const priceMax = notification.priceMax || Infinity;
                                        if (notification.discordWebhook.startsWith("https://discord.com/api/webhooks/") &&
                                            result.location
                                                .toLowerCase()
                                                .includes(notification.location.toLowerCase()) &&
                                            notification.priceMin <= result.price &&
                                            result.price <= priceMax &&
                                            result.type === notification.type) {
                                            yield (0, utils_1.sendCustomWebhookRealEstate)(result, notification.discordWebhook, "Price change");
                                        }
                                    }
                                }
                            }
                            if ((_a = pg.discordWebhook) === null || _a === void 0 ? void 0 : _a.startsWith("https://discord.com/api/webhooks/")) {
                                yield (0, utils_1.sendCustomWebhookRealEstate)(result, pg.discordWebhook, "Price change");
                            }
                        }
                    }
                }
                else {
                    newUnparsedListings.push(ad);
                }
            }
            console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][TOTAL ADS][${scrapedListings.length}]`);
            if (newUnparsedListings.length) {
                console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][NEW ADS][${newUnparsedListings.length}]`);
                console.dir(newUnparsedListings, { maxArrayLength: null });
            }
            else {
                console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][GET LISTINGS][NO CHANGE][${newUnparsedListings.length}]`);
            }
            resolve({ newUnparsedListings, updatedListings });
        });
    });
}
function checkPage(pg, newUnparsedListings) {
    return new Promise(function cb(resolve, reject) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const browser = yield puppeteer_extra_1.default.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            const page = yield browser.newPage();
            page.setDefaultTimeout(TIMEOUT);
            yield page.setCacheEnabled(false);
            const client = yield page.target().createCDPSession();
            yield client.send("Network.clearBrowserCookies");
            const ua = new user_agents_1.default();
            yield page.setUserAgent(ua.data.userAgent);
            yield page.setViewport({
                width: ua.data.viewportWidth,
                height: ua.data.viewportHeight,
            });
            yield page.setRequestInterception(true);
            page.on("request", (request) => {
                if (["font", "stylesheet", "media", "image"].includes(request.resourceType())) {
                    request.abort();
                }
                else {
                    request.continue();
                }
            });
            //firstInit variable set in order to avoid sendCustomWebhook spam
            let firstInit = (yield database_1.RealEstate.countDocuments({ type: pg.type }))
                ? false
                : true;
            const users = yield database_1.User.find({});
            let retriesCheckPage = 5;
            const newListings = [];
            while (newUnparsedListings.length) {
                const ad = newUnparsedListings.pop();
                try {
                    yield page.goto(ad.url, {
                        waitUntil: "networkidle2",
                    });
                    yield page.waitForFunction(() => !!(document.querySelector("div.content div.description") &&
                        document.querySelector("div.content div.params") &&
                        document.querySelector(".ob-c-carousel__item-content > noscript > img")));
                    const description = yield page.$eval("div.content", (el) => el.querySelector("div.description").innerText
                        .replace(/\s+/g, " ")
                        .trim());
                    const parameters = yield page.$eval("div.content", (el) => el.querySelector("div.params").innerText
                        .replace(/\n/g, " | ")
                        .replace(/\s+/g, " ")
                        .trim());
                    const images = yield page.$$eval(".ob-c-carousel__item-content > noscript > img", (elements) => elements
                        .map((el) => {
                        return el.src;
                    })
                        .filter(Boolean));
                    const fullInfo = {
                        name: ad.name,
                        location: ad.location,
                        price: ad.price,
                        priceHistory: [ad.price],
                        url: ad.url,
                        description: description,
                        parameters: parameters,
                        images: images,
                        type: ad.type,
                    };
                    console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][${ad.url}]`);
                    const newEntry = yield database_1.RealEstate.create(fullInfo);
                    newListings.push(newEntry);
                    if (!firstInit) {
                        if (users) {
                            for (const user of users) {
                                for (const notification of user.notifications) {
                                    const priceMax = notification.priceMax || Infinity;
                                    if (notification.discordWebhook.startsWith("https://discord.com/api/webhooks/") &&
                                        newEntry.location
                                            .toLowerCase()
                                            .includes(notification.location.toLowerCase()) &&
                                        notification.priceMin <= newEntry.price &&
                                        newEntry.price <= priceMax &&
                                        newEntry.type === notification.type) {
                                        yield (0, utils_1.sendCustomWebhookRealEstate)(newEntry, notification.discordWebhook, "New listing");
                                    }
                                }
                            }
                        }
                        if ((_a = pg.discordWebhook) === null || _a === void 0 ? void 0 : _a.startsWith("https://discord.com/api/webhooks/")) {
                            yield (0, utils_1.sendCustomWebhookRealEstate)(newEntry, pg.discordWebhook, "New listing");
                        }
                    }
                }
                catch (error) {
                    newUnparsedListings.push(ad);
                    if (error.name.includes("TimeoutError") ||
                        error.name.includes("ERR_CONNECTION_RESET") ||
                        error.name.includes("ERR_CONNECTION_CLOSED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][ERROR][POOR CONNECTION] `);
                    }
                    else if (error.name.includes("ERR_INTERNET_DISCONNECTED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][ERROR][NO CONNECTION]`);
                    }
                    else if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][ERROR][WRONG URL ADRRESS]`);
                        yield browser.close();
                        return reject(new Error("WRONG URL ADRRESS"));
                    }
                    else if (error.message.includes("Session closed. Most likely the page has been closed") ||
                        error.message.includes("Navigation failed because browser has disconnected!")) {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][ERROR][BROWSER HAS BEEN CLOSED]`);
                        yield browser.close();
                        return cb(resolve, reject);
                    }
                    else {
                        console.log(`[${(0, utils_1.getDateTime)()}][${pg.name}][CHECK PAGE][ERROR]`);
                        console.log(error);
                    }
                    retriesCheckPage--;
                    if (retriesCheckPage === 0) {
                        console.log(`[${(0, utils_1.getDateTime)()}][CHECK PAGE][ERROR][FAILED TO MANY TIMES]`);
                        yield browser.close();
                        return cb(resolve, reject);
                    }
                }
            }
            yield browser.close();
            resolve(newListings);
        });
    });
}
