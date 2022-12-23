import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());
import mongoose from "mongoose";
import UserAgent from "user-agents";
import dotenv from "dotenv";
dotenv.config();
import { RealEstate, User } from "../database";
import { getDateTime, sendCustomWebhookRealEstate } from "../utils";
import {
	IBasicInfo,
	IFullInfo,
	IPage,
	ILatestListings,
	IGetListingsResponse,
} from "../types";

const TIMEOUT = 60000;

export default async function monitor(pages: IPage[]) {
	try {
		await mongoose.connect(process.env.MONGO_URI as string);
	} catch (e) {
		console.log(`[${getDateTime()}][MONITOR][DB][ERROR]`);
		console.log(e);
		throw e;
	}

	console.log(`[${getDateTime()}][MONITOR][DB][CONNECTED]`);

	for (const pg of pages) {
		try {
			const { newUnparsedListings, updatedListings } = await getListings(pg);

			const latestListings: ILatestListings = {
				updatedListings: updatedListings,
				newListings: [],
			};

			if (newUnparsedListings.length) {
				const newListings = await checkPage(pg, newUnparsedListings);
				latestListings.newListings = newListings;
			}

			return latestListings;
		} catch (e) {
			await mongoose.connection.close();
			console.log(`[${getDateTime()}][MONITOR][DB][END]`);
			throw e;
		}
	}

	//console.dir(scrapedListings, { maxArrayLength: null });

	await mongoose.connection.close();
	console.log(`[${getDateTime()}][MONITOR][DB][END]`);
}

function getListings(pg: IPage) {
	return new Promise<IGetListingsResponse>(async function cb(
		resolve,
		reject
	): Promise<void> {
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		const page = await browser.newPage();
		page.setDefaultTimeout(TIMEOUT);
		await page.setCacheEnabled(false);
		const client = await page.target().createCDPSession();
		await client.send("Network.clearBrowserCookies");

		const ua = new UserAgent();
		await page.setUserAgent(ua.data.userAgent);

		await page.setViewport({
			width: ua.data.viewportWidth,
			height: ua.data.viewportHeight,
		});

		await page.setRequestInterception(true);
		page.on("request", (request) => {
			if (
				["font", "stylesheet", "media", "image"].includes(
					request.resourceType()
				)
			) {
				request.abort();
			} else {
				request.continue();
			}
		});

		await page.goto(pg.url, {
			waitUntil: "networkidle2",
		});

		let scrapedListings: IBasicInfo[] = [];
		let isBtnDisabled = false;
		let pageNumber = 1;
		let retriesMonitor = 3;
		while (!isBtnDisabled) {
			try {
				await page.waitForFunction(
					() => !!document.querySelector("div.property")
				);

				const currentAdsOnOnePage = await page.evaluate((type) => {
					const currentAdsOnOnePage: IBasicInfo[] = [];
					const ads = document.querySelectorAll("div.property");
					for (const ad of ads) {
						const price = (
							ad.querySelector(
								"div.text-wrap > span.basic > span.price"
							) as HTMLSpanElement
						).innerText
							.replace("Kč", "")
							.replace(/\s/g, "");

						const location = (
							ad.querySelector(
								"div.text-wrap > span.basic > span.locality"
							) as HTMLSpanElement
						).innerText;

						const name = (
							ad.querySelector(
								"div.text-wrap > span.basic > h2 > a > span.name"
							) as HTMLSpanElement
						).innerText;

						const url = (
							ad.querySelector(
								"div.text-wrap > span.basic > h2 > a"
							) as HTMLAnchorElement
						).href;

						const basicInfo: IBasicInfo = {
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
				console.log(
					`[${getDateTime()}][${
						pg.name
					}][GET LISTINGS][PAGE NUMBER: ${pageNumber}] `
				);

				await page.waitForFunction(
					() =>
						!!document.querySelector(
							"div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next"
						)
				);

				const isDisabled =
					(await page.$(
						"div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next.disabled"
					)) !== null;

				isBtnDisabled = isDisabled;
				if (!isDisabled) {
					await Promise.all([
						page.evaluate(() => {
							(
								document.querySelector(
									"div.paging > ul.paging-full > li.paging-item > a.btn-paging-pn.icof.icon-arr-right.paging-next"
								) as HTMLAnchorElement
							).click();
						}),
						page.waitForNavigation({ waitUntil: "networkidle2" }),
					]);

					pageNumber++;
				}
			} catch (error: any) {
				if (
					error.name.includes("TimeoutError") ||
					error.name.includes("ERR_CONNECTION_RESET") ||
					error.name.includes("ERR_CONNECTION_CLOSED")
				) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][GET LISTINGS][ERROR][POOR CONNECTION] `
					);
				} else if (error.name.includes("ERR_INTERNET_DISCONNECTED")) {
					console.log(
						`[${getDateTime()}][${pg.name}][GET LISTINGS][ERROR][NO CONNECTION]`
					);
				} else if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][GET LISTINGS][ERROR][WRONG URL ADRRESS]`
					);
					await browser.close();
					return reject(new Error("WRONG URL ADRRESS"));
				} else if (
					error.message.includes(
						"Session closed. Most likely the page has been closed"
					) ||
					error.message.includes(
						"Navigation failed because browser has disconnected!"
					)
				) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][GET LISTINGS][ERROR][BROWSER HAS BEEN CLOSED]`
					);
					await browser.close();
					return cb(resolve, reject);
				} else {
					console.log(`[${getDateTime()}][${pg.name}][GET LISTINGS][ERROR]`);
					console.log(error);
				}

				retriesMonitor--;
				if (retriesMonitor === 0) {
					console.log(
						`[${getDateTime()}][GET LISTINGS][ERROR][FAILED TO MANY TIMES]`
					);
					await browser.close();
					return cb(resolve, reject);
				}
			}
		}
		await browser.close();

		scrapedListings = scrapedListings.filter(
			(ad, index, self) => index === self.findIndex((obj) => obj.url === ad.url)
		);

		const users = await User.find({});
		const newUnparsedListings: IBasicInfo[] = [];
		const updatedListings: IFullInfo[] = [];

		for (const ad of scrapedListings) {
			const result = await RealEstate.findOne({ url: ad.url });
			if (result) {
				//PRICE CHANGE
				if (result.price !== ad.price) {
					if (
						ad.price === result.priceHistory[result.priceHistory.length - 2]
					) {
						console.log(
							`[${getDateTime()}][${
								pg.name
							}][GET LISTINGS][PRICE CHANGE][CACHE][${ad.url}]`
						);
					} else {
						console.log(
							`[${getDateTime()}][${pg.name}][GET LISTINGS][PRICE CHANGE][${
								ad.url
							}][OLD: ${result.price}][NEW: ${ad.price}]`
						);

						result.price = ad.price;
						result.priceHistory.push(ad.price);
						await result.save();
						updatedListings.push(result);

						if (users) {
							for (const user of users) {
								for (const notification of user.notifications) {
									const priceMax = notification.priceMax || Infinity;
									if (
										notification.discordWebhook.startsWith(
											"https://discord.com/api/webhooks/"
										) &&
										result.location
											.toLowerCase()
											.includes(notification.location.toLowerCase()) &&
										notification.priceMin <= result.price &&
										result.price <= priceMax &&
										result.type === notification.type
									) {
										await sendCustomWebhookRealEstate(
											result,
											notification.discordWebhook,
											"Price change"
										);
									}
								}
							}
						}

						if (
							pg.discordWebhook?.startsWith("https://discord.com/api/webhooks/")
						) {
							await sendCustomWebhookRealEstate(
								result,
								pg.discordWebhook,
								"Price change"
							);
						}
					}
				}
			} else {
				newUnparsedListings.push(ad);
			}
		}

		console.log(
			`[${getDateTime()}][${pg.name}][GET LISTINGS][TOTAL ADS][${
				scrapedListings.length
			}]`
		);

		if (newUnparsedListings.length) {
			console.log(
				`[${getDateTime()}][${pg.name}][GET LISTINGS][NEW ADS][${
					newUnparsedListings.length
				}]`
			);
			console.dir(newUnparsedListings, { maxArrayLength: null });
		} else {
			console.log(
				`[${getDateTime()}][${pg.name}][GET LISTINGS][NO CHANGE][${
					newUnparsedListings.length
				}]`
			);
		}

		resolve({ newUnparsedListings, updatedListings });
	});
}

function checkPage(pg: IPage, newUnparsedListings: IBasicInfo[]) {
	return new Promise<IFullInfo[]>(async function cb(
		resolve,
		reject
	): Promise<void> {
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		const page = await browser.newPage();
		page.setDefaultTimeout(TIMEOUT);
		await page.setCacheEnabled(false);
		const client = await page.target().createCDPSession();
		await client.send("Network.clearBrowserCookies");

		const ua = new UserAgent();
		await page.setUserAgent(ua.data.userAgent);

		await page.setViewport({
			width: ua.data.viewportWidth,
			height: ua.data.viewportHeight,
		});

		await page.setRequestInterception(true);
		page.on("request", (request) => {
			if (
				["font", "stylesheet", "media", "image"].includes(
					request.resourceType()
				)
			) {
				request.abort();
			} else {
				request.continue();
			}
		});

		//firstInit variable set in order to avoid sendCustomWebhook spam
		let firstInit = (await RealEstate.countDocuments({ type: pg.type }))
			? false
			: true;

		const users = await User.find({});
		let retriesCheckPage = 5;

		const newListings: IFullInfo[] = [];
		while (newUnparsedListings.length) {
			const ad = newUnparsedListings.pop() as IBasicInfo;
			try {
				await page.goto(ad.url, {
					waitUntil: "networkidle2",
				});
				await page.waitForFunction(
					() =>
						!!(
							document.querySelector("div.content div.description") &&
							document.querySelector("div.content div.params") &&
							document.querySelector(
								".ob-c-carousel__item-content > noscript > img"
							)
						)
				);

				const description = await page.$eval("div.content", (el) =>
					(el.querySelector("div.description") as HTMLDivElement).innerText
						.replace(/\s+/g, " ")
						.trim()
				);

				const parameters = await page.$eval("div.content", (el) =>
					(el.querySelector("div.params") as HTMLDivElement).innerText
						.replace(/\n/g, " | ")
						.replace(/\s+/g, " ")
						.trim()
				);

				const images = await page.$$eval(
					".ob-c-carousel__item-content > noscript > img",
					(elements) =>
						elements
							.map((el) => {
								return (el as HTMLImageElement).src;
							})
							.filter(Boolean)
				);

				const fullInfo: IFullInfo = {
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

				console.log(`[${getDateTime()}][${pg.name}][CHECK PAGE][${ad.url}]`);
				const newEntry = await RealEstate.create(fullInfo);
				newListings.push(newEntry);

				if (!firstInit) {
					if (users) {
						for (const user of users) {
							for (const notification of user.notifications) {
								const priceMax = notification.priceMax || Infinity;

								if (
									notification.discordWebhook.startsWith(
										"https://discord.com/api/webhooks/"
									) &&
									newEntry.location
										.toLowerCase()
										.includes(notification.location.toLowerCase()) &&
									notification.priceMin <= newEntry.price &&
									newEntry.price <= priceMax &&
									newEntry.type === notification.type
								) {
									await sendCustomWebhookRealEstate(
										newEntry,
										notification.discordWebhook,
										"New listing"
									);
								}
							}
						}
					}

					if (
						pg.discordWebhook?.startsWith("https://discord.com/api/webhooks/")
					) {
						await sendCustomWebhookRealEstate(
							newEntry,
							pg.discordWebhook,
							"New listing"
						);
					}
				}
			} catch (error: any) {
				newUnparsedListings.push(ad);

				if (
					error.name.includes("TimeoutError") ||
					error.name.includes("ERR_CONNECTION_RESET") ||
					error.name.includes("ERR_CONNECTION_CLOSED")
				) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][CHECK PAGE][ERROR][POOR CONNECTION] `
					);
				} else if (error.name.includes("ERR_INTERNET_DISCONNECTED")) {
					console.log(
						`[${getDateTime()}][${pg.name}][CHECK PAGE][ERROR][NO CONNECTION]`
					);
				} else if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][CHECK PAGE][ERROR][WRONG URL ADRRESS]`
					);

					await browser.close();
					return reject(new Error("WRONG URL ADRRESS"));
				} else if (
					error.message.includes(
						"Session closed. Most likely the page has been closed"
					) ||
					error.message.includes(
						"Navigation failed because browser has disconnected!"
					)
				) {
					console.log(
						`[${getDateTime()}][${
							pg.name
						}][CHECK PAGE][ERROR][BROWSER HAS BEEN CLOSED]`
					);

					await browser.close();
					return cb(resolve, reject);
				} else {
					console.log(`[${getDateTime()}][${pg.name}][CHECK PAGE][ERROR]`);
					console.log(error);
				}

				retriesCheckPage--;
				if (retriesCheckPage === 0) {
					console.log(
						`[${getDateTime()}][CHECK PAGE][ERROR][FAILED TO MANY TIMES]`
					);
					await browser.close();
					return cb(resolve, reject);
				}
			}
		}
		await browser.close();
		resolve(newListings);
	});
}
