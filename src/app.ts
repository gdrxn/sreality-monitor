import Express, { Request, Response } from "express";
import https from "https";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { getDateTime } from "./utils";
import { ILatestListings } from "./types";
dotenv.config();

const app = Express();
const corsConfig = {
	credentials: true,
	origin: process.env.CLIENT_URI as string,
	optionsSuccessStatus: 200,
};
app.use(cors(corsConfig));

app.set("trust proxy", 1);

/* 
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
*/

app.use(helmet());
app.disable("x-powered-by");

function preventFromSleep() {
	https.get(process.env.SERVER_URI as string, (res) => {
		if (res.statusCode === 200) {
			console.log(`[${getDateTime()}][PREVENT FROM SLEEP][SUCCESS]`);
		} else {
			console.log(`[${getDateTime()}][PREVENT FROM SLEEP][FAILED]`);
			preventFromSleep();
		}
	});
}
setInterval(() => {
	preventFromSleep();
}, 60000 * 12);

let statusLogs = [`[${getDateTime()}][STATUS][INIT]`];
let updates: ILatestListings = { updatedListings: [], newListings: [] };

app.get("/", (req: Request, res: Response) => {
	let statusLogsStringified = "";

	for (const status of statusLogs) {
		statusLogsStringified += `<div>${status}</div>`;
	}

	res.status(200).send(statusLogsStringified);
});

app.get("/feed", (req: Request, res: Response) => {
	res.status(200).send(updates);
});

app.listen(process.env.PORT, () => {
	console.log(`Server is running on port ${process.env.PORT}`);
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { IPage } from "./types";
import monitor from "./classes/RealEstateClass";

const pages: IPage[] = [
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

async function start() {
	try {
		const latestListings = await monitor(pages);
		const currentStatus = `[${getDateTime()}][STATUS][SUCCESS]`;
		statusLogs.push(currentStatus);

		if (latestListings) updates = latestListings;

		console.log(currentStatus);
	} catch (e) {
		const currentStatus = `[${getDateTime()}][STATUS][ERROR][${
			(e as Error).message
		}]`;
		statusLogs.push(currentStatus);

		console.log(currentStatus);
	}
}

start();
setInterval(start, 60000 * 60 * 12);
