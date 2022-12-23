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
const express_1 = __importDefault(require("express"));
const https_1 = __importDefault(require("https"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const utils_1 = require("./utils");
dotenv_1.default.config();
const app = (0, express_1.default)();
const corsConfig = {
    credentials: true,
    origin: process.env.CLIENT_URI,
    optionsSuccessStatus: 200,
};
app.use((0, cors_1.default)(corsConfig));
app.set("trust proxy", 1);
/*
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
*/
app.use((0, helmet_1.default)());
app.disable("x-powered-by");
function preventFromSleep() {
    https_1.default.get(process.env.SERVER_URI, (res) => {
        if (res.statusCode === 200) {
            console.log(`[${(0, utils_1.getDateTime)()}][PREVENT FROM SLEEP][SUCCESS]`);
        }
        else {
            console.log(`[${(0, utils_1.getDateTime)()}][PREVENT FROM SLEEP][FAILED]`);
            preventFromSleep();
        }
    });
}
setInterval(() => {
    preventFromSleep();
}, 60000 * 12);
let statusLogs = [`[${(0, utils_1.getDateTime)()}][STATUS][INIT]`];
let updates = { updatedListings: [], newListings: [] };
app.get("/", (req, res) => {
    let statusLogsStringified = "";
    for (const status of statusLogs) {
        statusLogsStringified += `<div>${status}</div>`;
    }
    res.status(200).send(statusLogsStringified);
});
app.get("/feed", (req, res) => {
    res.status(200).send(updates);
});
app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
const RealEstateClass_1 = __importDefault(require("./classes/RealEstateClass"));
const pages = [
    {
        name: "",
        url: "",
        type: "",
        discordWebhook: process.env.DISCORD_WEBHOOK,
    },
    /* {
        name: "Apartments: 5-12mil",
        url: "https://www.sreality.cz/hledani/prodej/byty/praha?cena-od=5000000&cena-do=12000000&bez-aukce=1",
        type: "apartment",
        discordWebhook:
            "https://discord.com/api/webhooks/1015213618486333521/BgrMyHL_HR07tu1xOzcGYBwdCjQiLRe1q7cPAjkZ071u1k01hK1wxC6a4DVtXgm0ZM3V",
    }, */
];
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const latestListings = yield (0, RealEstateClass_1.default)(pages);
            const currentStatus = `[${(0, utils_1.getDateTime)()}][STATUS][SUCCESS]`;
            statusLogs.push(currentStatus);
            if (latestListings)
                updates = latestListings;
            console.log(currentStatus);
        }
        catch (e) {
            const currentStatus = `[${(0, utils_1.getDateTime)()}][STATUS][ERROR][${e.message}]`;
            statusLogs.push(currentStatus);
            console.log(currentStatus);
        }
    });
}
start();
setInterval(start, 60000 * 60 * 12);
