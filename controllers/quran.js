import axios from "axios"
import { reciters } from "../data/reciters.js"

export const getAyahBySurahNumberAndVerseNumber = async (req, res) => {
  const { ayah } = req.params

  if (!ayah) {
    return res
      .status(400)
      .json({ code: 400, status: "Error", message: "Missing ayah parameter. Use '/surahNumber:verseNumber'" })
  }

  const [surahNumber, verseNumber] = ayah.split(":")

  if (!surahNumber || !verseNumber) {
    return res
      .status(400)
      .json({ code: 400, status: "Error", message: "Invalid ayah format. Use 'surahNumber:verseNumber'" })
  }

  const url = `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/ar.alafasy`

  try {
    const response = await axios.get(url)
    const data = response.data // axios already parses the JSON

    if (data.code === 200 && data.status === "OK") {
      // Add the dynamic image URL to the response
      const verseImage = `https://cdn.islamic.network/quran/images/${surahNumber}_${verseNumber}.png`
      data.data.verseImage = verseImage

      // Find the correct reciter subfolder
      const reciter = reciters.find((r) => r.name === "Minshawy Murattal") // You can change this to any reciter you prefer
      if (reciter) {
        const audioUrl = `https://everyayah.com/data/${reciter.subfolder}/${surahNumber.padStart(3, "0")}${verseNumber.padStart(3, "0")}.mp3`
        data.data.audio = audioUrl
      } else {
        data.data.audio = null // or some default URL if preferred
      }

      res.status(200).json(data)
    } else {
      res.status(data.code || 500).json(data)
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error)
    res.status(500).json({ code: 500, status: "Error", message: "Failed to fetch Quran data" })
  }
}

export const getSurahs = async (req, res) => {
  const url = "http://api.alquran.cloud/v1/surah"

  try {
    const response = await axios.get(url)
    const data = response.data // axios already parses the JSON

    if (data.code === 200 && data.status === "OK") {
      res.status(200).json(data)
    } else {
      res.status(data.code || 500).json(data)
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error)
    res.status(500).json({ code: 500, status: "Error", message: "Failed to fetch Quran data" })
  }
}
export const getSurahByNumber = async (req, res) => {
  const { surahNumber } = req.params

  if (!surahNumber) {
    return res
      .status(400)
      .json({ code: 400, status: "Error", message: "Missing surahNumber parameter" })
  }

  const url = `http://api.alquran.cloud/v1/surah/${surahNumber}`

  try {
    const response = await axios.get(url)
    const data = response.data // axios already parses the JSON

    if (data.code === 200 && data.status === "OK") {
      res.status(200).json(data)
    } else {
      res.status(data.code || 500).json(data)
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error)
    res.status(500).json({ code: 500, status: "Error", message: "Failed to fetch Quran data" })
  } 
}