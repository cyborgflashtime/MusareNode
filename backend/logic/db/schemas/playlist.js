export default {
	displayName: { type: String, min: 2, max: 32, required: true },
	songs: { type: Array },
	createdBy: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, required: true },
	privacy: { type: String, enum: ["public", "private"], default: "private" }
};
