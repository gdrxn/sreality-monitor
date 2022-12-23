"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.RealEstate = exports.userSchema = void 0;
const mongoose_1 = require("mongoose");
const realEstateSchema = new mongoose_1.Schema({
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
const notificationsSchema = new mongoose_1.Schema({
    location: { type: String, required: true },
    type: { type: String, required: true },
    priceMin: { type: Number, required: true },
    priceMax: { type: Number, required: true },
    discordWebhook: { type: String, required: true },
});
exports.userSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true },
    hash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    notifications: { type: [notificationsSchema], required: true },
});
exports.RealEstate = (0, mongoose_1.model)("RealEstate", realEstateSchema);
exports.User = (0, mongoose_1.model)("User", exports.userSchema);
