import async from "async";

import { isAdminRequired } from "./hooks";

import moduleManager from "../../index";

const DBModule = moduleManager.modules.db;
const UtilsModule = moduleManager.modules.utils;
const IOModule = moduleManager.modules.io;
const CacheModule = moduleManager.modules.cache;

CacheModule.runJob("SUB", {
	channel: "news.create",
	cb: news => {
		IOModule.runJob("EMIT_TO_ROOM", {
			room: "admin.news",
			args: ["event:admin.news.created", news]
		});
	}
});

CacheModule.runJob("SUB", {
	channel: "news.remove",
	cb: news => {
		IOModule.runJob("EMIT_TO_ROOM", {
			room: "admin.news",
			args: ["event:admin.news.removed", news]
		});
	}
});

CacheModule.runJob("SUB", {
	channel: "news.update",
	cb: news => {
		IOModule.runJob("EMIT_TO_ROOM", {
			room: "admin.news",
			args: ["event:admin.news.updated", news]
		});
	}
});

export default {
	/**
	 * Gets all news items
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {Function} cb - gets called with the result
	 */
	async index(session, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		async.waterfall(
			[
				next => {
					newsModel.find({}).sort({ createdAt: "desc" }).exec(next);
				}
			],
			async (err, news) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "NEWS_INDEX", `Indexing news failed. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "NEWS_INDEX", `Indexing news successful.`, false);
				return cb({ status: "success", data: news });
			}
		);
	},

	/**
	 * Gets a news item by id
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} newsId - the news id
	 * @param {Function} cb - gets called with the result
	 */
	async getNewsFromId(session, newsId, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		async.waterfall(
			[
				next => {
					newsModel.findOne({ _id: newsId }, next);
				}
			],
			async (err, news) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "GET_NEWS_FROM_ID", `Getting news failed. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "GET_NEWS_FROM_ID", `Got news successful.`, false);
				return cb({ status: "success", data: news });
			}
		);
	},
	/**
	 * Creates a news item
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {object} data - the object of the news data
	 * @param {Function} cb - gets called with the result
	 */
	create: isAdminRequired(async function create(session, data, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		async.waterfall(
			[
				next => {
					data.createdBy = session.userId;
					data.createdAt = Date.now();
					newsModel.create(data, next);
				}
			],
			async (err, news) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "NEWS_CREATE", `Creating news failed. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				CacheModule.runJob("PUB", { channel: "news.create", value: news });
				this.log("SUCCESS", "NEWS_CREATE", `Creating news successful.`);
				return cb({
					status: "success",
					message: "Successfully created News"
				});
			}
		);
	}),

	/**
	 * Gets the latest news item
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {Function} cb - gets called with the result
	 */
	async newest(session, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		async.waterfall(
			[
				next => {
					newsModel.findOne({}).sort({ createdAt: "desc" }).exec(next);
				}
			],
			async (err, news) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "NEWS_NEWEST", `Getting the latest news failed. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "NEWS_NEWEST", `Successfully got the latest news.`, false);
				return cb({ status: "success", data: news });
			}
		);
	},

	/**
	 * Removes a news item
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {object} news - the news object
	 * @param {Function} cb - gets called with the result
	 */
	// TODO Pass in an id, not an object
	// TODO Fix this
	remove: isAdminRequired(async function remove(session, news, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		newsModel.deleteOne({ _id: news._id }, async err => {
			if (err) {
				err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
				this.log(
					"ERROR",
					"NEWS_REMOVE",
					`Removing news "${news._id}" failed for user "${session.userId}". "${err}"`
				);
				return cb({ status: "failure", message: err });
			}
			CacheModule.runJob("PUB", { channel: "news.remove", value: news });
			this.log("SUCCESS", "NEWS_REMOVE", `Removing news "${news._id}" successful by user "${session.userId}".`);
			return cb({
				status: "success",
				message: "Successfully removed News"
			});
		});
	}),

	/**
	 * Removes a news item
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} _id - the news id
	 * @param {object} news - the news object
	 * @param {Function} cb - gets called with the result
	 */
	// TODO Fix this
	update: isAdminRequired(async function update(session, _id, news, cb) {
		const newsModel = await DBModule.runJob("GET_MODEL", { modelName: "news" }, this);
		newsModel.updateOne({ _id }, news, { upsert: true }, async err => {
			if (err) {
				err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
				this.log(
					"ERROR",
					"NEWS_UPDATE",
					`Updating news "${_id}" failed for user "${session.userId}". "${err}"`
				);
				return cb({ status: "failure", message: err });
			}
			CacheModule.runJob("PUB", { channel: "news.update", value: news });
			this.log("SUCCESS", "NEWS_UPDATE", `Updating news "${_id}" successful for user "${session.userId}".`);
			return cb({
				status: "success",
				message: "Successfully updated News"
			});
		});
	})
};
