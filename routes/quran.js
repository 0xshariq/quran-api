import express from "express"
import { getAyahBySurahNumberAndVerseNumber, getSurahs, getSurahByNumber } from "../controllers/quran.js"

const router = express.Router()

// Update the route to use a wildcard parameter
router.get("/surahs", getSurahs)
router.get("/surah/:surahNumber", getSurahByNumber)
router.get("/:ayah(*)", getAyahBySurahNumberAndVerseNumber)

export default router

