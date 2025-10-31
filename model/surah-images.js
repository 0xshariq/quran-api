import mongoose from "mongoose";

const surahImageSchema = new mongoose.Schema({
    surahNumber: { type: Number, required: true },
    pageNumber: { type: Number, required: true },
    imageUrl: { type: String, required: true }
});

// unique per surah+page
surahImageSchema.index({ surahNumber: 1, pageNumber: 1 }, { unique: true });

const SurahImages = mongoose.models.SurahImages || mongoose.model("SurahImages", surahImageSchema);

export default SurahImages;