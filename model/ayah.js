import mongoose, { Schema, model } from "mongoose";

const ayahSchema = new Schema({
    number: { type: Number, required: true, unique: true },
    audio: { type: String },
    audioSecondary: { type: [String], default: [] },
    text: { type: String },
    verseImage: { type: String },
    // store the edition metadata (not an ObjectId) and support multiple editions
    edition: { type: Schema.Types.Mixed, default: null },
    surah: {
        number: { type: Number },
        name: { type: String },
        englishName: { type: String },
        englishNameTranslation: { type: String },
        numberOfAyahs: { type: Number },
        revelationType: { type: String }
    },
    numberInSurah: { type: Number },
    juz: { type: Number },
    manzil: { type: Number },
    page: { type: Number },
    ruku: { type: Number },
    hizbQuarter: { type: Number },
    // `sajda` can be either a boolean or an object like { id, recommended, obligatory }
    // accept both shapes using Mixed and default to false when absent
    sajda: { type: Schema.Types.Mixed, default: false }
});

const Ayah = mongoose.models.Ayah || model("Ayah", ayahSchema);

export default Ayah;