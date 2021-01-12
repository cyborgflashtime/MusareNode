<template>
	<div id="currently-playing">
		<figure class="thumbnail">
			<div
				v-if="currentSong.ytThumbnail"
				id="yt-thumbnail-bg"
				:style="{
					'background-image': 'url(' + currentSong.ytThumbnail + ')'
				}"
			></div>
			<img
				v-if="currentSong.ytThumbnail"
				:src="currentSong.ytThumbnail"
				onerror="this.src='/assets/notes-transparent.png'"
			/>
			<img
				v-else
				:src="currentSong.thumbnail"
				onerror="this.src='/assets/notes-transparent.png'"
			/>
		</figure>
		<div id="song-info">
			<h6>Currently playing...</h6>
			<h4
				id="song-title"
				:style="!currentSong.artists ? { fontSize: '17px' } : null"
			>
				{{ currentSong.title }}
			</h4>
			<h5 id="song-artists" v-if="currentSong.artists">
				{{ currentSong.artists }}
			</h5>
			<p id="song-request-time">
				Requested <strong>15 minutes ago</strong>
			</p>
			<div id="song-actions">
				<button
					class="button"
					id="report-icon"
					v-if="loggedIn && !currentSong.simpleSong"
					@click="
						openModal({
							sector: 'station',
							modal: 'report'
						})
					"
				>
					<i class="material-icons icon-with-button">flag</i>Report
				</button>
				<a
					class="button"
					id="youtube-icon"
					target="_blank"
					:href="
						`https://www.youtube.com/watch?v=${currentSong.songId}`
					"
				>
					<div class="icon"></div>
				</a>
			</div>
		</div>
	</div>
</template>

<script>
import { mapState, mapActions } from "vuex";

export default {
	computed: {
		...mapState("station", {
			currentSong: state => state.currentSong
		}),
		...mapState({
			loggedIn: state => state.user.auth.loggedIn
		})
	},
	methods: {
		...mapActions("modals", ["openModal"])
	}
};
</script>

<style lang="scss" scoped>
@import "../../../styles/global.scss";

#currently-playing {
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	height: 100%;
	padding: 10px;

	.thumbnail {
		min-width: 140px;
		max-height: 140px;
		height: 100%;
		position: relative;

		#yt-thumbnail-bg {
			height: 100%;
			width: 100%;
			position: absolute;
			top: 0;
			filter: blur(1px);
			background: url("/assets/notes-transparent.png") no-repeat center
				center;
		}

		img {
			height: auto;
			width: 100%;
			margin-top: auto;
			margin-bottom: auto;
			z-index: 1;
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			right: 0;
		}
	}

	@media (max-width: 1500px) {
		#song-actions {
			.button {
				padding: 0 10px !important;
			}
		}

		#song-info {
			margin-left: 0 !important;
		}

		.thumbnail {
			display: none;
		}
	}

	#song-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		margin-left: 20px;
		width: 100%;
		height: 100%;

		*:not(i) {
			margin: 0;
			font-family: Karla, Arial, sans-serif;
		}

		h6 {
			color: $musare-blue !important;
			font-weight: bold;
			font-size: 17px;
		}

		#song-title {
			margin-top: 7px;
			font-size: 22px;
		}

		#song-artists {
			font-size: 16px;
		}

		#song-request-time {
			font-size: 12px;
			margin-top: 7px;
			color: $dark-grey;
		}

		#song-actions {
			margin-top: 10px;

			.button {
				color: #fff;
				padding: 0 15px;
				border: 0;
			}

			#report-icon {
				background-color: $grey;
			}

			#youtube-icon {
				background-color: #bd2e2e;

				&:after {
					content: "View on YouTube";

					@media (max-width: 1800px) {
						content: "Open";
					}
				}

				.icon {
					margin-right: 3px;
					height: 20px;
					width: 20px;
					-webkit-mask: url("/assets/social/youtube.svg") no-repeat
						center;
					mask: url("/assets/social/youtube.svg") no-repeat center;
					background-color: #fff;
				}
			}
		}
	}
}
</style>