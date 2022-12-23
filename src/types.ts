export interface IBasicInfo {
	name: string;
	location: string;
	price: number;
	url: string;
	type: HouseOrApartment;
}

export interface IFullInfo {
	name: string;
	location: string;
	url: string;
	price: number;
	priceHistory: number[];
	description: string;
	parameters: string;
	images: string[];
	type: HouseOrApartment;
}

export interface IPage {
	name: string;
	url: string;
	type: HouseOrApartment;
	discordWebhook?: string;
}

export interface IUser {
	email: string;
	hash: string;
	firstName: string;
	lastName: string;
	notifications: INotifications[];
}

export interface INotifications {
	location: string;
	type: HouseOrApartment;
	priceMin: number;
	priceMax: number;
	discordWebhook: string;
}

export type HouseOrApartment = "House" | "Apartment";

export interface IGetListingsResponse {
	newUnparsedListings: IBasicInfo[];
	updatedListings: IFullInfo[];
}

export interface ILatestListings {
	updatedListings: IFullInfo[];
	newListings: IFullInfo[];
}
