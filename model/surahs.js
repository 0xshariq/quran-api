import mongoose, {Schema,model} from "mongoose";

const surahsSchema = new Schema({
	number: { type: Number, required: true, unique: true },
	name: { type: String, required: true },
	englishName: { type: String },
	englishNameTranslation: { type: String },
	numberOfAyahs: { type: Number },
	revelationType: { type: String }
});

const AllSurah = mongoose.models.AllSurah || model("AllSurah", surahsSchema);

export default AllSurah;