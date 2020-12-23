/* eslint no-param-reassign: 0 */

const state = {
	station: {},
	privatePlaylistQueueSelected: null,
	editing: {},
	userCount: 0,
	users: [],
	currentSong: {},
	previousSong: null,
	songsList: [],
	stationPaused: true,
	localPaused: false,
	noSong: true
};

const getters = {};

const actions = {
	joinStation: ({ commit }, station) => {
		commit("joinStation", station);
	},
	editStation: ({ commit }, station) => {
		commit("editStation", station);
	},
	updateUserCount: ({ commit }, userCount) => {
		commit("updateUserCount", userCount);
	},
	updateUsers: ({ commit }, users) => {
		commit("updateUsers", users);
	},
	updateCurrentSong: ({ commit }, currentSong) => {
		commit("updateCurrentSong", currentSong);
	},
	updatePreviousSong: ({ commit }, previousSong) => {
		commit("updatePreviousSong", previousSong);
	},
	updateSongsList: ({ commit }, songsList) => {
		commit("updateSongsList", songsList);
	},
	updateStationPaused: ({ commit }, stationPaused) => {
		commit("updateStationPaused", stationPaused);
	},
	updateLocalPaused: ({ commit }, localPaused) => {
		commit("updateLocalPaused", localPaused);
	},
	updateNoSong: ({ commit }, noSong) => {
		commit("updateNoSong", noSong);
	},
	updatePrivatePlaylistQueueSelected: ({ commit }, status) => {
		commit("updatePrivatePlaylistQueueSelected", status);
	}
};

const mutations = {
	joinStation(state, station) {
		state.station = { ...station };
	},
	editStation(state, station) {
		state.editing = { ...station };
	},
	updateUserCount(state, userCount) {
		state.userCount = userCount;
	},
	updateUsers(state, users) {
		state.users = users;
	},
	updateCurrentSong(state, currentSong) {
		if (currentSong.likes === -1 && currentSong.dislikes === -1) {
			currentSong.skipDuration = 0;
			currentSong.simpleSong = true;
		} else {
			currentSong.simpleSong = false;
		}

		state.currentSong = currentSong;
	},
	updatePreviousSong(state, previousSong) {
		state.previousSong = previousSong;
	},
	updateSongsList(state, songsList) {
		state.songsList = songsList;
	},
	updateStationPaused(state, stationPaused) {
		state.stationPaused = stationPaused;
	},
	updateLocalPaused(state, localPaused) {
		state.localPaused = localPaused;
	},
	updateNoSong(state, noSong) {
		state.noSong = noSong;
	},
	updatePrivatePlaylistQueueSelected(state, status) {
		state.privatePlaylistQueueSelected = status;
	}
};

export default {
	namespaced: true,
	state,
	getters,
	actions,
	mutations
};