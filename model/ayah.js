import mongoose, { Schema, model } from "mongoose";

const ayahSchema = new Schema({
    number: { type: Number, required: true, unique: true },
    audio: { type: String },
    audioSecondary: { type: [String], default: [] },
    text: { type: String },
    verseImage: { type: String },
    edition: {
        type: Schema.Types.ObjectId,
        ref: 'Edition'
    },
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
    sajda: { type: Boolean, default: false }
});

const Ayah = mongoose.models.Ayah || model("Ayah", ayahSchema);

export default Ayah;