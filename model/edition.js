import mongoose, { Schema, model } from "mongoose";

const editionSchema = new Schema({
    identifier: { type: String },
    language: { type: String },
    name: { type: String },
    englishName: { type: String },
    format: { type: String },
    type: { type: String },
    direction: { type: String, default: null }

})

const Edition = mongoose.models.Edition || model("Edition", editionSchema);

export default Edition;