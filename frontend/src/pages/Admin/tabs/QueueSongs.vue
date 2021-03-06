<template>
	<div v-scroll="handleScroll">
		<metadata title="Admin | Queue songs" />
		<div class="container">
			<p>
				<span>Sets loaded: {{ setsLoaded }} / {{ maxSets }}</span>
				<br />
				<span>Loaded songs: {{ this.songs.length }}</span>
			</p>
			<input
				v-model="searchQuery"
				type="text"
				class="input"
				placeholder="Search for Songs"
			/>
			<button
				v-if="!loadAllSongs"
				class="button is-primary"
				@click="loadAll()"
			>
				Load all
			</button>
			<button
				class="button is-primary"
				@click="toggleKeyboardShortcutsHelper"
				@dblclick="resetKeyboardShortcutsHelper"
			>
				Keyboard shortcuts helper
			</button>
			<br />
			<br />
			<table class="table is-striped">
				<thead>
					<tr>
						<td>Thumbnail</td>
						<td>Title</td>
						<td>Artists</td>
						<td>Genres</td>
						<td>ID / YouTube ID</td>
						<td>Requested By</td>
						<td>Options</td>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(song, index) in filteredSongs"
						:key="index"
						tabindex="0"
						@keydown.up.prevent
						@keydown.down.prevent
						@keyup.up="selectPrevious($event)"
						@keyup.down="selectNext($event)"
						@keyup.e="edit(song, index)"
						@keyup.a="add(song)"
						@keyup.x="remove(song._id, index)"
					>
						<td>
							<img
								class="song-thumbnail"
								:src="song.thumbnail"
								onerror="this.src='/assets/notes-transparent.png'"
							/>
						</td>
						<td>
							<strong>{{ song.title }}</strong>
						</td>
						<td>{{ song.artists.join(", ") }}</td>
						<td>{{ song.genres.join(", ") }}</td>
						<td>
							{{ song._id }}
							<br />
							<a
								:href="
									'https://www.youtube.com/watch?v=' +
										`${song.songId}`
								"
								target="_blank"
							>
								{{ song.songId }}</a
							>
						</td>
						<td>
							<user-id-to-username
								:user-id="song.requestedBy"
								:link="true"
							/>
						</td>
						<td class="optionsColumn">
							<button
								class="button is-primary"
								@click="edit(song, index)"
							>
								<i class="material-icons">edit</i>
							</button>
							<button
								class="button is-success"
								@click="add(song)"
							>
								<i class="material-icons">add</i>
							</button>
							<button
								class="button is-danger"
								@click="remove(song._id, index)"
							>
								<i class="material-icons">cancel</i>
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		<edit-song
			v-if="modals.editSong"
			:song-id="editingSongId"
			song-type="queueSongs"
		/>
		<floating-box
			id="keyboardShortcutsHelper"
			ref="keyboardShortcutsHelper"
		>
			<template #body>
				<div>
					<div>
						<span class="biggest"><b>Queue songs page</b></span>
						<span
							><b>Arrow keys up/down</b> - Moves between
							songs</span
						>
						<span><b>E</b> - Edit selected song</span>
						<span><b>A</b> - Add selected song</span>
						<span><b>X</b> - Delete selected song</span>
					</div>
					<hr />
					<div>
						<span class="biggest"><b>Edit song modal</b></span>
						<span class="bigger"><b>Navigation</b></span>
						<span><b>Home</b> - Edit</span>
						<span><b>End</b> - Edit</span>
						<hr />
						<span class="bigger"><b>Player controls</b></span>
						<span><b>Numpad up/down</b> - Volume up/down 10%</span>
						<span
							><b>Ctrl + Numpad up/down</b> - Volume up/down
							1%</span
						>
						<span><b>Numpad center</b> - Pause/resume</span>
						<span><b>Ctrl + Numpad center</b> - Stop</span>
						<span
							><b>Numpad Right</b> - Skip to last 10 seconds</span
						>
						<hr />
						<span class="bigger"><b>Form control</b></span>
						<span
							><b>Ctrl + D</b> - Executes purple button in that
							input</span
						>
						<span
							><b>Ctrl + Alt + D</b> - Fill in all Discogs
							fields</span
						>
						<span
							><b>Ctrl + R</b> - Executes red button in that
							input</span
						>
						<span
							><b>Ctrl + Alt + R</b> - Reset duration field</span
						>
						<hr />
						<span class="bigger"><b>Modal control</b></span>
						<span><b>Ctrl + S</b> - Save</span>
						<span><b>Ctrl + X</b> - Exit</span>
					</div>
				</div>
			</template>
		</floating-box>
	</div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import Vue from "vue";

import Toast from "toasters";

import EditSong from "../../../components/modals/EditSong.vue";
import UserIdToUsername from "../../../components/common/UserIdToUsername.vue";

import FloatingBox from "../../../components/ui/FloatingBox.vue";

import ScrollAndFetchHandler from "../../../mixins/ScrollAndFetchHandler.vue";

import io from "../../../io";

export default {
	components: { EditSong, UserIdToUsername, FloatingBox },
	mixins: [ScrollAndFetchHandler],
	data() {
		return {
			editingSongId: "",
			searchQuery: "",
			songs: []
		};
	},
	computed: {
		filteredSongs() {
			return this.songs.filter(
				song =>
					JSON.stringify(Object.values(song)).indexOf(
						this.searchQuery
					) !== -1
			);
		},
		...mapState("modalVisibility", {
			modals: state => state.modals.admin
		})
	},
	watch: {
		// eslint-disable-next-line func-names
		"modals.editSong": function(value) {
			if (value === false) this.stopVideo();
		}
	},
	mounted() {
		io.getSocket(socket => {
			this.socket = socket;

			this.socket.on("event:admin.queueSong.added", queueSong => {
				this.songs.push(queueSong);
			});

			this.socket.on("event:admin.queueSong.removed", songId => {
				this.songs = this.songs.filter(song => {
					return song._id !== songId;
				});
			});

			this.socket.on("event:admin.queueSong.updated", updatedSong => {
				for (let i = 0; i < this.songs.length; i += 1) {
					const song = this.songs[i];
					if (song._id === updatedSong._id) {
						Vue.set(this.songs, i, updatedSong);
					}
				}
			});

			if (this.socket.connected) this.init();
			io.onConnect(() => {
				this.init();
			});
		});
	},
	methods: {
		edit(song) {
			// const newSong = {};
			// Object.keys(song).forEach(n => {
			// 	newSong[n] = song[n];
			// });

			// this.editSong({ index, song: newSong, type: "queueSongs" });
			this.editingSongId = song._id;
			this.openModal({ sector: "admin", modal: "editSong" });
		},
		add(song) {
			this.socket.emit("songs.add", song, res => {
				if (res.status === "success")
					new Toast({ content: res.message, timeout: 2000 });
				else new Toast({ content: res.message, timeout: 4000 });
			});
		},
		remove(id) {
			// eslint-disable-next-line
			const dialogResult = window.confirm(
				"Are you sure you want to delete this song?"
			);
			if (dialogResult !== true) return;
			this.socket.emit("queueSongs.remove", id, res => {
				if (res.status === "success")
					new Toast({ content: res.message, timeout: 2000 });
				else new Toast({ content: res.message, timeout: 4000 });
			});
		},
		getSet() {
			if (this.gettingSet) return;
			if (this.position >= this.maxPosition) return;
			this.gettingSet = true;

			this.socket.emit("queueSongs.getSet", this.position, data => {
				data.forEach(song => this.songs.push(song));

				this.position += 1;
				this.gettingSet = false;
			});
		},
		selectPrevious(event) {
			if (event.srcElement.previousElementSibling)
				event.srcElement.previousElementSibling.focus();
		},
		selectNext(event) {
			if (event.srcElement.nextElementSibling)
				event.srcElement.nextElementSibling.focus();
		},
		toggleKeyboardShortcutsHelper() {
			this.$refs.keyboardShortcutsHelper.toggleBox();
		},
		resetKeyboardShortcutsHelper() {
			this.$refs.keyboardShortcutsHelper.resetBox();
		},
		init() {
			if (this.songs.length > 0)
				this.position = Math.ceil(this.songs.length / 15) + 1;

			this.socket.emit("queueSongs.length", length => {
				this.maxPosition = Math.ceil(length / 15) + 1;

				this.getSet();
			});

			this.socket.emit("apis.joinAdminRoom", "queue", () => {});
		},
		// ...mapActions("admin/songs", ["editSong"]),
		...mapActions("modals/editSong", ["stopVideo"]),
		...mapActions("modalVisibility", ["openModal"])
	}
};
</script>

<style lang="scss" scoped>
.night-mode {
	.table {
		color: var(--light-grey-2);
		background-color: var(--dark-grey-3);

		thead tr {
			background: var(--dark-grey-3);
			td {
				color: var(--white);
			}
		}

		tbody tr:hover {
			background-color: var(--dark-grey-4) !important;
		}

		tbody tr:nth-child(even) {
			background-color: var(--dark-grey-2);
		}

		strong {
			color: var(--light-grey-2);
		}
	}
}

.optionsColumn {
	width: 140px;
	button {
		width: 35px;
	}
}

.song-thumbnail {
	display: block;
	max-width: 50px;
	margin: 0 auto;
}

td {
	vertical-align: middle;
}

#keyboardShortcutsHelper {
	.box-body {
		b {
			color: var(--black);
		}

		.biggest {
			font-size: 18px;
		}

		.bigger {
			font-size: 16px;
		}

		span {
			display: block;
		}
	}
}

.is-primary:focus {
	background-color: var(--primary-color) !important;
}
</style>
