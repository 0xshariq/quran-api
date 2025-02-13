import express from "express"
import { getAyahBySurahNumberAndVerseNumber, getSurahs, getSurahByNumber, getAudio, getReciters, paraImages, surahImages, getQuran } from "../controllers/quran.js"

const router = express.Router()

// Update the route to use a wildcard parameter
router.get("/surah", getSurahs)
router.get("/surah/:surahNumber", getSurahByNumber)
router.get("/audio/:reciter/:number", getAudio)
router.get("/reciters", getReciters)
router.get("/para/:pageNo", paraImages)
router.get("/surah/:pageNo", surahImages)
router.get("/", getQuran)
router.get("/:ayah(*)", getAyahBySurahNumberAndVerseNumber)

export default router

