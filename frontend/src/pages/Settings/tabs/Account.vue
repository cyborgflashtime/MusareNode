<template>
	<div class="content account-tab">
		<h4 class="section-title">Change account details</h4>

		<p class="section-description">
			Keep these details up-to-date.
		</p>

		<hr class="section-horizontal-rule" />

		<p class="control is-expanded margin-top-zero">
			<label for="username">Username</label>
			<input
				class="input"
				id="username"
				type="text"
				placeholder="Enter username here..."
				v-model="modifiedUser.username"
				maxlength="32"
				autocomplete="off"
				@blur="onInputBlur('username')"
			/>
			<span v-if="modifiedUser.username" class="character-counter"
				>{{ modifiedUser.username.length }}/32</span
			>
		</p>
		<transition name="fadein-helpbox">
			<input-help-box
				:valid="validation.username.valid"
				:message="validation.username.message"
			></input-help-box>
		</transition>

		<p class="control is-expanded">
			<label for="email">Email</label>
			<input
				class="input"
				id="email"
				type="text"
				placeholder="Enter email address here..."
				v-if="modifiedUser.email"
				v-model="modifiedUser.email.address"
				@blur="onInputBlur('email')"
				autocomplete="off"
			/>
		</p>
		<transition name="fadein-helpbox">
			<input-help-box
				:valid="validation.email.valid"
				:message="validation.email.message"
			></input-help-box>
		</transition>

		<transition name="saving-changes-transition" mode="out-in">
			<button
				class="button save-changes"
				:class="saveButtonStyle"
				@click="saveChanges()"
				:key="saveStatus"
				:disabled="saveStatus === 'disabled'"
				v-html="saveButtonMessage"
			/>
		</transition>

		<!-- <div class="section-margin-bottom" />

		<h4 class="section-title">Export my data</h4>

		<p class="section-description">
			Download a copy of all data we store on you in JSON format.
		</p>

		<hr class="section-horizontal-rule" /> -->

		<div class="section-margin-bottom" />

		<h4 class="section-title">Remove any data we hold on you</h4>

		<p class="section-description">
			Permanently remove your account and/or data we store on you.
		</p>

		<hr class="section-horizontal-rule" />

		<div>
			<a
				class="button is-warning"
				href="#"
				@click.prevent="removeActivities()"
			>
				<i class="material-icons icon-with-button">clear</i>
				Clear my activities
			</a>

			<a
				class="button is-danger"
				href="#"
				@click.prevent="removeAccount()"
			>
				<i class="material-icons icon-with-button">delete</i>
				Remove my account
			</a>
		</div>
	</div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import Toast from "toasters";

import validation from "../../../validation";
import io from "../../../io";

import InputHelpBox from "../../../components/ui/InputHelpBox.vue";
import SaveButton from "../../../mixins/SaveButton.vue";

export default {
	components: { InputHelpBox },
	mixins: [SaveButton],
	data() {
		return {
			validation: {
				username: {
					entered: false,
					valid: false,
					message: "Please enter a valid username."
				},
				email: {
					entered: false,
					valid: false,
					message: "Please enter a valid email address."
				}
			}
		};
	},
	computed: mapState({
		userId: state => state.user.auth.userId,
		originalUser: state => state.settings.originalUser,
		modifiedUser: state => state.settings.modifiedUser
	}),
	watch: {
		// prettier-ignore
		// eslint-disable-next-line func-names
		"modifiedUser.username": function (value) {
		if (!validation.isLength(value, 2, 32)) {
			this.validation.username.message =
				"Username must have between 2 and 32 characters.";
			this.validation.username.valid = false;
		} else if (
			!validation.regex.azAZ09_.test(value) &&
			value !== this.originalUser.username // Sometimes a username pulled from GitHub won't succeed validation
		) {
				this.validation.username.message =
					"Invalid username format. Allowed characters: a-z, A-Z, 0-9 and _.";
				this.validation.username.valid = false;
			} else {
				this.validation.username.message = "Everything looks great!";
				this.validation.username.valid = true;
			}
		},
		// prettier-ignore
		// eslint-disable-next-line func-names
		"modifiedUser.email.address": function (value) {
			if (!validation.isLength(value, 3, 254)) {
				this.validation.email.message =
					"Email must have between 3 and 254 characters.";
				this.validation.email.valid = false;
			} else if (
				value.indexOf("@") !== value.lastIndexOf("@") ||
				!validation.regex.emailSimple.test(value)
			) {
				this.validation.email.message = "Invalid Email format.";
				this.validation.email.valid = false;
			} else {
				this.validation.email.message = "Everything looks great!";
				this.validation.email.valid = true;
			}
		}
	},
	mounted() {
		io.getSocket(socket => {
			this.socket = socket;
		});
	},
	methods: {
		onInputBlur(inputName) {
			this.validation[inputName].entered = true;
		},
		saveChanges() {
			const usernameChanged =
				this.modifiedUser.username !== this.originalUser.username;
			const emailAddressChanged =
				this.modifiedUser.email.address !==
				this.originalUser.email.address;

			if (usernameChanged) this.changeUsername();

			if (emailAddressChanged) this.changeEmail();

			if (!usernameChanged && !emailAddressChanged) {
				this.handleFailedSave();

				new Toast({
					content: "Please make a change before saving.",
					timeout: 8000
				});
			}
		},
		changeEmail() {
			const email = this.modifiedUser.email.address;
			if (!validation.isLength(email, 3, 254))
				return new Toast({
					content: "Email must have between 3 and 254 characters.",
					timeout: 8000
				});
			if (
				email.indexOf("@") !== email.lastIndexOf("@") ||
				!validation.regex.emailSimple.test(email)
			)
				return new Toast({
					content: "Invalid email format.",
					timeout: 8000
				});

			this.saveStatus = "disabled";

			return this.socket.emit(
				"users.updateEmail",
				this.userId,
				email,
				res => {
					if (res.status !== "success") {
						new Toast({ content: res.message, timeout: 8000 });
						this.handleFailedSave();
					} else {
						new Toast({
							content: "Successfully changed email address",
							timeout: 4000
						});

						this.updateOriginalUser({
							property: "email.address",
							value: email
						});

						this.handleSuccessfulSave();
					}
				}
			);
		},
		changeUsername() {
			const { username } = this.modifiedUser;

			if (!validation.isLength(username, 2, 32))
				return new Toast({
					content: "Username must have between 2 and 32 characters.",
					timeout: 8000
				});

			if (!validation.regex.azAZ09_.test(username))
				return new Toast({
					content:
						"Invalid username format. Allowed characters: a-z, A-Z, 0-9 and _.",
					timeout: 8000
				});

			this.saveStatus = "disabled";

			return this.socket.emit(
				"users.updateUsername",
				this.userId,
				username,
				res => {
					if (res.status !== "success") {
						new Toast({ content: res.message, timeout: 8000 });
						this.handleFailedSave();
					} else {
						new Toast({
							content: "Successfully changed username",
							timeout: 4000
						});

						this.updateOriginalUser({
							property: "username",
							value: username
						});

						this.handleSuccessfulSave();
					}
				}
			);
		},
		removeAccount() {
			return this.socket.emit("users.remove", res => {
				if (res.status === "success") {
					return this.socket.emit("users.logout", () => {
						return lofig.get("cookie").then(cookie => {
							document.cookie = `${cookie.SIDname}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
							return window.location.reload();
						});
					});
				}

				return new Toast({ content: res.message, timeout: 8000 });
			});
		},
		removeActivities() {
			this.socket.emit("activities.removeAllForUser", res => {
				new Toast({ content: res.message, timeout: 4000 });
			});
		},
		...mapActions("settings", ["updateOriginalUser"])
	}
};
</script>
