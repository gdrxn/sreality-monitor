import { model, Schema } from "mongoose";
import { IFullInfo, IUser, INotifications } from "./types";

const realEstateSchema = new Schema<IFullInfo>({
	name: { type: String, required: true },
	location: { type: String, required: true },
	url: { type: String, required: true, unique: true },
	price: { type: Number, required: true },
	priceHistory: { type: [Number], required: true },
	description: { type: String, required: true },
	parameters: { type: String, required: true },
	type: { type: String, required: true },
	images: { type: [String], required: true },
});

const notificationsSchema = new Schema<INotifications>({
	location: { type: String, required: true },
	type: { type: String, required: true },
	priceMin: { type: Number, required: true },
	priceMax: { type: Number, required: true },
	discordWebhook: { type: String, required: true },
});

export const userSchema = new Schema<IUser>({
	email: { type: String, required: true, unique: true },
	hash: { type: String, required: true },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	notifications: { type: [notificationsSchema], required: true },
});

export const RealEstate = model<IFullInfo>("RealEstate", realEstateSchema);
export const User = model<IUser>("User", userSchema);
