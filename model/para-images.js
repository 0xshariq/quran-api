import mongoose from "mongoose";

const paraImageSchema = new mongoose.Schema({
    paraNumber: { type: Number, required: true },
    pageNumber: { type: Number, required: true },
    imageUrl: { type: String, required: true }
});

// unique per para+page
paraImageSchema.index({ paraNumber: 1, pageNumber: 1 }, { unique: true });

const ParaImages = mongoose.models.ParaImages || mongoose.model("ParaImages", paraImageSchema);

export default ParaImages;