import config from "config";

import async from "async";

import { isAdminRequired, isLoginRequired } from "./hooks";

import moduleManager from "../../index";

const DBModule = moduleManager.modules.db;
const UtilsModule = moduleManager.modules.utils;
const IOModule = moduleManager.modules.io;
const YouTubeModule = moduleManager.modules.youtube;
const CacheModule = moduleManager.modules.cache;

CacheModule.runJob("SUB", {
	channel: "queue.newSong",
	cb: async songId => {
		const queueSongModel = await DBModule.runJob("GET_MODEL", {
			modelName: "queueSong"
		});
		queueSongModel.findOne({ _id: songId }, (err, song) => {
			IOModule.runJob("EMIT_TO_ROOM", {
				room: "admin.queue",
				args: ["event:admin.queueSong.added", song]
			});
		});
	}
});

CacheModule.runJob("SUB", {
	channel: "queue.removedSong",
	cb: songId => {
		IOModule.runJob("EMIT_TO_ROOM", {
			room: "admin.queue",
			args: ["event:admin.queueSong.removed", songId]
		});
	}
});

CacheModule.runJob("SUB", {
	channel: "queue.update",
	cb: async songId => {
		const queueSongModel = await DBModule.runJob("GET_MODEL", {
			modelName: "queueSong"
		});
		queueSongModel.findOne({ _id: songId }, (err, song) => {
			IOModule.runJob("EMIT_TO_ROOM", {
				room: "admin.queue",
				args: ["event:admin.queueSong.updated", song]
			});
		});
	}
});

export default {
	/**
	 * Returns the length of the queue songs list
	 *
	 * @param session
	 * @param cb
	 */
	length: isAdminRequired(async function length(session, cb) {
		const queueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);
		async.waterfall(
			[
				next => {
					queueSongModel.countDocuments({}, next);
				}
			],
			async (err, count) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "QUEUE_SONGS_LENGTH", `Failed to get length from queue songs. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "QUEUE_SONGS_LENGTH", `Got length from queue songs successfully.`);
				return cb(count);
			}
		);
	}),

	/**
	 * Gets a set of queue songs
	 *
	 * @param session
	 * @param set - the set number to return
	 * @param cb
	 */
	getSet: isAdminRequired(async function getSet(session, set, cb) {
		const queueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);
		async.waterfall(
			[
				next => {
					queueSongModel
						.find({})
						.skip(15 * (set - 1))
						.limit(15)
						.exec(next);
				}
			],
			async (err, songs) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "QUEUE_SONGS_GET_SET", `Failed to get set from queue songs. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "QUEUE_SONGS_GET_SET", `Got set from queue songs successfully.`);
				return cb(songs);
			}
		);
	}),

	/**
	 * Gets a song from the Musare song id
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} songId - the Musare song id
	 * @param {Function} cb
	 */
	getSongFromMusareId: isAdminRequired(async function getSong(session, songId, cb) {
		const queueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);

		async.waterfall(
			[
				next => {
					queueSongModel.findOne({ _id: songId }, next);
				}
			],
			async (err, song) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log("ERROR", "QUEUE_SONGS_GET_SONG_FROM_MUSARE_ID", `Failed to get song ${songId}. "${err}"`);
					return cb({ status: "failure", message: err });
				}
				this.log("SUCCESS", "QUEUE_SONGS_GET_SONG_FROM_MUSARE_ID", `Got song ${songId} successfully.`);
				return cb({ status: "success", data: { song } });
			}
		);
	}),

	/**
	 * Updates a queuesong
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} songId - the id of the queuesong that gets updated
	 * @param {object} updatedSong - the object of the updated queueSong
	 * @param {Function} cb - gets called with the result
	 */
	update: isAdminRequired(async function update(session, songId, updatedSong, cb) {
		const queueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);
		async.waterfall(
			[
				next => {
					queueSongModel.findOne({ _id: songId }, next);
				},

				(song, next) => {
					if (!song) return next("Song not found");

					let updated = false;

					const $set = {};
					Object.keys(updatedSong).forEach(prop => {
						if (updatedSong[prop] !== song[prop]) $set[prop] = updatedSong[prop];
					});

					updated = true;
					if (!updated) return next("No properties changed");

					return queueSongModel.updateOne({ _id: songId }, { $set }, { runValidators: true }, next);
				}
			],
			async err => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log(
						"ERROR",
						"QUEUE_UPDATE",
						`Updating queuesong "${songId}" failed for user ${session.userId}. "${err}"`
					);
					return cb({ status: "failure", message: err });
				}
				CacheModule.runJob("PUB", { channel: "queue.update", value: songId });
				this.log(
					"SUCCESS",
					"QUEUE_UPDATE",
					`User "${session.userId}" successfully update queuesong "${songId}".`
				);
				return cb({
					status: "success",
					message: "Successfully updated song."
				});
			}
		);
	}),

	/**
	 * Removes a queuesong
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} songId - the id of the queuesong that gets removed
	 * @param {Function} cb - gets called with the result
	 */
	remove: isAdminRequired(async function remove(session, songId, cb) {
		const queueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);
		async.waterfall(
			[
				next => {
					queueSongModel.deleteOne({ _id: songId }, next);
				}
			],
			async err => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log(
						"ERROR",
						"QUEUE_REMOVE",
						`Removing queuesong "${songId}" failed for user ${session.userId}. "${err}"`
					);
					return cb({ status: "failure", message: err });
				}
				CacheModule.runJob("PUB", {
					channel: "queue.removedSong",
					value: songId
				});
				this.log(
					"SUCCESS",
					"QUEUE_REMOVE",
					`User "${session.userId}" successfully removed queuesong "${songId}".`
				);
				return cb({
					status: "success",
					message: "Successfully updated song."
				});
			}
		);
	}),

	/**
	 * Creates a queuesong
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} songId - the id of the song that gets added
	 * @param {Function} cb - gets called with the result
	 */
	add: isLoginRequired(async function add(session, songId, cb) {
		const requestedAt = Date.now();
		const songModel = await DBModule.runJob("GET_MODEL", { modelName: "song" }, this);
		const userModel = await DBModule.runJob("GET_MODEL", { modelName: "user" }, this);
		const QueueSongModel = await DBModule.runJob(
			"GET_MODEL",
			{
				modelName: "queueSong"
			},
			this
		);

		async.waterfall(
			[
				next => {
					QueueSongModel.findOne({ songId }, next);
				},

				(song, next) => {
					if (song) return next("This song is already in the queue.");
					return songModel.findOne({ songId }, next);
				},

				// Get YouTube data from id
				(song, next) => {
					if (song) return next("This song has already been added.");
					// TODO Add err object as first param of callback
					return YouTubeModule.runJob("GET_SONG", { songId }, this)
						.then(response => {
							const { song } = response;
							song.duration = -1;
							song.artists = [];
							song.genres = [];
							song.skipDuration = 0;
							song.thumbnail = `${config.get("domain")}/assets/notes.png`;
							song.explicit = false;
							song.requestedBy = session.userId;
							song.requestedAt = requestedAt;
							next(null, song);
						})
						.catch(next);
				},
				(newSong, next) => {
					const song = new QueueSongModel(newSong);
					song.save({ validateBeforeSave: false }, (err, song) => {
						if (err) return next(err);
						return next(null, song);
					});
				},
				(newSong, next) => {
					userModel.findOne({ _id: session.userId }, (err, user) => {
						if (err) return next(err, newSong);

						user.statistics.songsRequested += 1;

						return user.save(err => {
							if (err) return next(err, newSong);
							return next(null, newSong);
						});
					});
				}
			],
			async (err, newSong) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log(
						"ERROR",
						"QUEUE_ADD",
						`Adding queuesong "${songId}" failed for user ${session.userId}. "${err}"`
					);
					return cb({ status: "failure", message: err });
				}
				CacheModule.runJob("PUB", {
					channel: "queue.newSong",
					value: newSong._id
				});
				this.log("SUCCESS", "QUEUE_ADD", `User "${session.userId}" successfully added queuesong "${songId}".`);
				return cb({
					status: "success",
					message: "Successfully added that song to the queue"
				});
			}
		);
	}),

	/**
	 * Adds a set of songs to the queue
	 *
	 * @param {object} session - the session object automatically added by socket.io
	 * @param {string} url - the url of the the YouTube playlist
	 * @param {boolean} musicOnly - whether to only get music from the playlist
	 * @param {Function} cb - gets called with the result
	 */
	addSetToQueue: isLoginRequired(function addSetToQueue(session, url, musicOnly, cb) {
		async.waterfall(
			[
				next => {
					YouTubeModule.runJob(
						"GET_PLAYLIST",
						{
							url,
							musicOnly
						},
						this
					)
						.then(res => {
							next(null, res.songs);
						})
						.catch(next);
				},
				(songIds, next) => {
					let successful = 0;
					let failed = 0;
					let alreadyInQueue = 0;
					let alreadyAdded = 0;

					if (songIds.length === 0) next();

					async.eachLimit(
						songIds,
						1,
						(songId, next) => {
							IOModule.runJob(
								"RUN_ACTION2",
								{
									session,
									namespace: "queueSongs",
									action: "add",
									args: [songId]
								},
								this
							)
								.then(res => {
									if (res.status === "success") successful += 1;
									else failed += 1;
									if (res.message === "This song is already in the queue.") alreadyInQueue += 1;
									if (res.message === "This song has already been added.") alreadyAdded += 1;
								})
								.catch(() => {
									failed += 1;
								})
								.finally(() => {
									next();
								});
						},
						() => {
							next(null, { successful, failed, alreadyInQueue, alreadyAdded });
						}
					);
				}
			],
			async (err, response) => {
				if (err) {
					err = await UtilsModule.runJob("GET_ERROR", { error: err }, this);
					this.log(
						"ERROR",
						"QUEUE_IMPORT",
						`Importing a YouTube playlist to the queue failed for user "${session.userId}". "${err}"`
					);
					return cb({ status: "failure", message: err });
				}
				this.log(
					"SUCCESS",
					"QUEUE_IMPORT",
					`Successfully imported a YouTube playlist to the queue for user "${session.userId}".`
				);
				return cb({
					status: "success",
					message: `Playlist is done importing. ${response.successful} were added succesfully, ${response.failed} failed (${response.alreadyInQueue} were already in queue, ${response.alreadyAdded} were already added)`
				});
			}
		);
	})
};
