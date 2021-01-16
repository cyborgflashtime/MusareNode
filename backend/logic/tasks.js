import async from "async";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import CoreClass from "../core";
import Timer from "../classes/Timer.class";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let TasksModule;
let CacheModule;
let StationsModule;
let UtilsModule;
let IOModule;
let DBModule;

class _TasksModule extends CoreClass {
	// eslint-disable-next-line require-jsdoc
	constructor() {
		super("tasks");

		this.tasks = {};

		TasksModule = this;
	}

	/**
	 * Initialises the tasks module
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	initialize() {
		return new Promise(resolve => {
			// return reject(new Error("Not fully migrated yet."));

			CacheModule = this.moduleManager.modules.cache;
			StationsModule = this.moduleManager.modules.stations;
			UtilsModule = this.moduleManager.modules.utils;
			IOModule = this.moduleManager.modules.io;
			DBModule = this.moduleManager.modules.db;

			// this.createTask("testTask", testTask, 5000, true);

			TasksModule.runJob("CREATE_TASK", {
				name: "stationSkipTask",
				fn: TasksModule.checkStationSkipTask,
				timeout: 1000 * 60 * 30
			});

			TasksModule.runJob("CREATE_TASK", {
				name: "sessionClearTask",
				fn: TasksModule.sessionClearingTask,
				timeout: 1000 * 60 * 60 * 6
			});

			// TasksModule.runJob("CREATE_TASK", {
			// 	name: "logFileSizeCheckTask",
			// 	fn: TasksModule.logFileSizeCheckTask,
			// 	timeout: 1000 * 60 * 60
			// });

			TasksModule.runJob("CREATE_TASK", {
				name: "collectStationUsersTask",
				fn: TasksModule.collectStationUsersTask,
				timeout: 1000 * 3
			});

			resolve();
		});
	}

	/**
	 * Creates a new task
	 *
	 * @param {object} payload - object that contains the payload
	 * @param {string} payload.name - the name of the task
	 * @param {string} payload.fn - the function the task will run
	 * @param {string} payload.paused - if the task is currently paused
	 * @param {boolean} payload.timeout - how often to run the task
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	CREATE_TASK(payload) {
		return new Promise((resolve, reject) => {
			TasksModule.tasks[payload.name] = {
				name: payload.name,
				fn: payload.fn,
				timeout: payload.timeout,
				lastRan: 0,
				timer: null
			};

			if (!payload.paused) {
				TasksModule.runJob("RUN_TASK", { name: payload.name }, this)
					.then(() => resolve())
					.catch(err => reject(err));
			} else resolve();
		});
	}

	/**
	 * Pauses a task
	 *
	 * @param {object} payload - object that contains the payload
	 * @param {string} payload.taskName - the name of the task to pause
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	PAUSE_TASK(payload) {
		const taskName = { payload };

		return new Promise(resolve => {
			if (TasksModule.tasks[taskName].timer) TasksModule.tasks[taskName].timer.pause();
			resolve();
		});
	}

	/**
	 * Resumes a task
	 *
	 * @param {object} payload - object that contains the payload
	 * @param {string} payload.name - the name of the task to resume
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	RESUME_TASK(payload) {
		return new Promise(resolve => {
			TasksModule.tasks[payload.name].timer.resume();
			resolve();
		});
	}

	/**
	 * Runs a task's function and restarts the timer
	 *
	 * @param {object} payload - object that contains the payload
	 * @param {string} payload.name - the name of the task to run
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	RUN_TASK(payload) {
		return new Promise(resolve => {
			const task = TasksModule.tasks[payload.name];
			if (task.timer) task.timer.pause();

			task.fn.apply(null).then(() => {
				task.lastRan = Date.now();
				task.timer = new Timer(
					() => TasksModule.runJob("RUN_TASK", { name: payload.name }),
					task.timeout,
					false
				);
				resolve();
			});
		});
	}

	/**
	 * Periodically checks if any stations need to be skipped
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	checkStationSkipTask() {
		return new Promise(resolve => {
			TasksModule.log("INFO", "TASK_STATIONS_SKIP_CHECK", `Checking for stations to be skipped.`, false);
			async.waterfall(
				[
					next => {
						CacheModule.runJob("HGETALL", { table: "stations" })
							.then(response => next(null, response))
							.catch(next);
					},
					(stations, next) => {
						async.each(
							stations,
							(station, next2) => {
								if (station.paused || !station.currentSong || !station.currentSong.title)
									return next2();
								const timeElapsed = Date.now() - station.startedAt - station.timePaused;
								if (timeElapsed <= station.currentSong.duration) return next2();

								TasksModule.log(
									"ERROR",
									"TASK_STATIONS_SKIP_CHECK",
									`Skipping ${station._id} as it should have skipped already.`
								);
								return StationsModule.runJob("INITIALIZE_STATION", {
									stationId: station._id
								}).then(() => next2());
							},
							() => next()
						);
					}
				],
				() => resolve()
			);
		});
	}

	/**
	 * Periodically checks if any sessions are out of date and need to be cleared
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	sessionClearingTask() {
		return new Promise(resolve => {
			TasksModule.log("INFO", "TASK_SESSION_CLEAR", `Checking for sessions to be cleared.`);

			async.waterfall(
				[
					next => {
						CacheModule.runJob("HGETALL", { table: "sessions" })
							.then(sessions => next(null, sessions))
							.catch(next);
					},
					(sessions, next) => {
						if (!sessions) return next();

						const keys = Object.keys(sessions);

						return async.each(
							keys,
							(sessionId, next2) => {
								const session = sessions[sessionId];

								if (
									session &&
									session.refreshDate &&
									Date.now() - session.refreshDate < 60 * 60 * 24 * 30 * 1000
								)
									return next2();

								if (!session) {
									TasksModule.log("INFO", "TASK_SESSION_CLEAR", "Removing an empty session.");
									return CacheModule.runJob("HDEL", {
										table: "sessions",
										key: sessionId
									}).finally(() => {
										next2();
									});
								}
								if (!session.refreshDate) {
									session.refreshDate = Date.now();
									return CacheModule.runJob("HSET", {
										table: "sessions",
										key: sessionId,
										value: session
									}).finally(() => next2());
								}
								if (Date.now() - session.refreshDate > 60 * 60 * 24 * 30 * 1000) {
									return IOModule.runJob("SOCKETS_FROM_SESSION_ID", {
										sessionId: session.sessionId
									}).then(response => {
										if (response.sockets.length > 0) {
											session.refreshDate = Date.now();
											CacheModule.runJob("HSET", {
												table: "sessions",
												key: sessionId,
												value: session
											}).finally(() => {
												next2();
											});
										} else {
											TasksModule.log(
												"INFO",
												"TASK_SESSION_CLEAR",
												`Removing session ${sessionId} for user ${session.userId} since inactive for 30 days and not currently in use.`
											);
											CacheModule.runJob("HDEL", {
												table: "sessions",
												key: session.sessionId
											}).finally(() => next2());
										}
									});
								}
								TasksModule.log("ERROR", "TASK_SESSION_CLEAR", "This should never log.");
								return next2();
							},
							() => next()
						);
					}
				],
				() => resolve()
			);
		});
	}

	/**
	 * Periodically warns about the size of any log files
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	logFileSizeCheckTask() {
		return new Promise((resolve, reject) => {
			TasksModule.log("INFO", "TASK_LOG_FILE_SIZE_CHECK", `Checking the size for the log files.`);
			async.each(
				["all.log", "debugStation.log", "error.log", "info.log", "success.log"],
				(fileName, next) => {
					try {
						const stats = fs.statSync(path.resolve(__dirname, "../../log/", fileName));
						const mb = stats.size / 1000000;
						if (mb > 25) return next(true);

						return next();
					} catch (err) {
						return next(err);
					}
				},
				async err => {
					if (err && err !== true) {
						err = await UtilsModule.runJob("GET_ERROR", { error: err });
						return reject(new Error(err));
					}
					if (err === true) {
						TasksModule.log(
							"ERROR",
							"LOGGER_FILE_SIZE_WARNING",
							"************************************WARNING*************************************"
						);
						TasksModule.log(
							"ERROR",
							"LOGGER_FILE_SIZE_WARNING",
							"***************ONE OR MORE LOG FILES APPEAR TO BE MORE THAN 25MB****************"
						);
						TasksModule.log(
							"ERROR",
							"LOGGER_FILE_SIZE_WARNING",
							"****MAKE SURE TO REGULARLY CLEAR UP THE LOG FILES, MANUALLY OR AUTOMATICALLY****"
						);
						TasksModule.log(
							"ERROR",
							"LOGGER_FILE_SIZE_WARNING",
							"********************************************************************************"
						);
					}

					return resolve();
				}
			);
		});
	}

	/**
	 * Periodically collect users in stations
	 *
	 * @returns {Promise} - returns promise (reject, resolve)
	 */
	async collectStationUsersTask() {
		const userModel = await DBModule.runJob("GET_MODEL", { modelName: "user" });

		return new Promise(resolve => {
			TasksModule.log("INFO", "TASK_COLLECT_STATION_USERS_TASK", `Checking for users in stations.`, false);

			const stationsCountUpdated = [];
			const stationsUpdated = [];

			// const oldUsersPerStation = JSON.parse(JSON.stringify(StationsModule.usersPerStation));
			const usersPerStation = {};

			const oldUsersPerStationCount = JSON.parse(JSON.stringify(StationsModule.usersPerStationCount));
			const usersPerStationCount = {};

			async.each(
				Object.keys(StationsModule.userList),
				(socketId, next) => {
					IOModule.runJob("SOCKET_FROM_SESSION", { socketId }).then(socket => {
						const stationId = StationsModule.userList[socketId];

						if (!socket || Object.keys(socket.rooms).indexOf(`station.${stationId}`) === -1) {
							if (stationsCountUpdated.indexOf(stationId) === -1) stationsCountUpdated.push(stationId);
							if (stationsUpdated.indexOf(stationId) === -1) stationsUpdated.push(stationId);
							delete StationsModule.userList[socketId];
							return next();
						}

						if (!usersPerStationCount[stationId]) usersPerStationCount[stationId] = 0;
						usersPerStationCount[stationId] += 1;
						if (!usersPerStation[stationId]) usersPerStation[stationId] = [];

						return async.waterfall(
							[
								next => {
									if (!socket.session || !socket.session.sessionId) return next("No session found.");
									return CacheModule.runJob("HGET", {
										table: "sessions",
										key: socket.session.sessionId
									})
										.then(session => {
											next(null, session);
										})
										.catch(next);
								},

								(session, next) => {
									if (!session) return next("Session not found.");
									return userModel.findOne({ _id: session.userId }, next);
								},

								(user, next) => {
									if (!user) return next("User not found.");
									if (usersPerStation[stationId].indexOf(user.username) !== -1)
										return next("User already in the list.");
									return next(null, { username: user.username, avatar: user.avatar });
								}
							],
							(err, user) => {
								if (!err) {
									usersPerStation[stationId].push(user);
								}
								next();
							}
						);
					});
					// TODO Code to show users
				},
				() => {
					Object.keys(usersPerStationCount).forEach(stationId => {
						if (oldUsersPerStationCount[stationId] !== usersPerStationCount[stationId]) {
							if (stationsCountUpdated.indexOf(stationId) === -1) stationsCountUpdated.push(stationId);
						}
					});

					// Object.keys(usersPerStation).forEach(stationId => {
					// 	if (
					// 		_.difference(usersPerStation[stationId], oldUsersPerStation[stationId]).length > 0 ||
					// 		_.difference(oldUsersPerStation[stationId], usersPerStation[stationId]).length > 0
					// 	) {
					// 		if (stationsUpdated.indexOf(stationId) === -1) stationsUpdated.push(stationId);
					// 	}
					// });

					StationsModule.usersPerStationCount = usersPerStationCount;
					StationsModule.usersPerStation = usersPerStation;

					stationsCountUpdated.forEach(stationId => {
						this.log("INFO", "UPDATE_STATION_USER_COUNT", `Updating user count of ${stationId}.`);
						CacheModule.runJob("PUB", {
							table: "station.updateUserCount",
							value: stationId
						});
					});

					stationsUpdated.forEach(stationId => {
						this.log("INFO", "UPDATE_STATION_USER_LIST", `Updating user list of ${stationId}.`);
						CacheModule.runJob("PUB", {
							table: "station.updateUsers",
							value: stationId
						});
					});

					// console.log("Userlist", StationsModule.usersPerStation);
				}
			);

			resolve();
		});
	}
}

export default new _TasksModule();
