import express from "express"
import { getAyahBySurahNumberAndVerseNumber, getSurahs, getSurahByNumber, getAudio, getReciters, paraImages, surahImages } from "../controllers/quran.js"

const router = express.Router()

// Update the route to use a wildcard parameter
router.get("/surah", getSurahs)
router.get("/surah/:surahNumber", getSurahByNumber)
router.get("/audio/:reciter/:surahNumber/:verseNumber", getAudio)
router.get("/reciters", getReciters)
router.get("/para_page/:pageNo", paraImages)
router.get("/surah_page/:pageNo", surahImages)
router.get("/:ayah(*)", getAyahBySurahNumberAndVerseNumber)

export default router

