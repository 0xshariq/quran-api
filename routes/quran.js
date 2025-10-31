import express from "express"
import { getAyahBySurahNumberAndVerseNumber, getSurahs, getSurahByNumber, getAudio, getReciters, paraImages, surahImages, getQuran, getEditions } from "../controllers/quran.js"

const router = express.Router()

// Update the route to use a wildcard parameter
router.get("/surah", getSurahs)
router.get("/surah/:surahNumber", getSurahByNumber)
router.get("/audio/:reciter/:number", getAudio)
router.get("/reciters", getReciters)
router.get("/para-page/:pageNo", paraImages)
router.get("/surah-page/:pageNo", surahImages)
router.get("/", getQuran)
router.get("/editions", getEditions)
router.get("/:ayah(*)", getAyahBySurahNumberAndVerseNumber)

export default router

