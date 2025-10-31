import mongoose, { Schema, model } from "mongoose";

const surahSchema = new Schema({
    number: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    englishName: { type: String },
    englishNameTranslation: { type: String },
    numberOfAyahs: { type: Number },
    revelationType: { type: String },
    surahAudio: { type: String }, // https://cdn.islamic.network/quran/audio-surah/128/{edition}/{surahNumber}.mp3
    ayahs: [
        {
            number: { type: Number, required: true, unique: true },
            text: { type: String, required: true, unique: true },
            numberInSurah: { type: Number },
            juz: { type: Number },
            manzil: { type: Number },
            page: { type: Number },
            ruku: { type: Number },
            hizbQuarter: { type: Number },
            sajda: { type: Boolean, default: false }
        }
    ]
    ,
    edition: {
        type: Schema.Types.ObjectId,
        ref: 'Edition'
    }
});

const Surah = mongoose.models.Surah || model("Surah", surahSchema);

export default Surah;