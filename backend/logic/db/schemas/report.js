export default {
	resolved: { type: Boolean, default: false, required: true },
	song: {
		_id: { type: String, required: true },
		songId: { type: String, required: true }
	},
	description: { type: String },
	issues: [
		{
			name: String,
			reasons: Array
		}
	],
	createdBy: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, required: true },
	documentVersion: { type: Number, default: 1, required: true }
};
