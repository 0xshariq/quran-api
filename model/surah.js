import mongoose, { Schema, model } from "mongoose";

const surahSchema = new Schema({
    number: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    englishName: { type: String },
    englishNameTranslation: { type: String },
    numberOfAyahs: { type: Number },
    revelationType: { type: String },
    // aggregated audio per edition (identifier + audio url), e.g. [{ identifier, audio }]
    surahAudio: { type: [Schema.Types.Mixed], default: [] }, // https://cdn.islamic.network/quran/audio-surah/128/{edition}/{surahNumber}.mp3
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
            // allow sajda to be boolean or object { id, recommended, obligatory }
            sajda: { type: Schema.Types.Mixed, default: false }
        }
    ]
    ,
    // keep an example single edition object and also the full editions list
    edition: { type: Schema.Types.Mixed, default: null }
});

const Surah = mongoose.models.Surah || model("Surah", surahSchema);

export default Surah;