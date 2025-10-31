import axios from "axios";
import { reciters } from "../data/reciters.js";
import { surahs } from "../data/surah.js";
import { quran } from "../data/quran.js";
import { editions } from "../data/edition.js";

export const getAyahBySurahNumberAndVerseNumber = async (req, res) => {
  try {
    const { ayah } = req.params;
    const { lang } = req.query;

    if (!ayah) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Missing ayah parameter. Use '/surahNumber:verseNumber'",
      });
    }

    const [surahNumber, verseNumber] = ayah.split(":");

    if (!surahNumber || !verseNumber || isNaN(surahNumber) || isNaN(verseNumber)) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Invalid ayah format. Use 'surahNumber:verseNumber'",
      });
    }

    // Define the translation mapping
    const translations = {
      arabic: "ar.alafasy",
      eng: "en.asad",
      urdu: "ur.junagarhi",
    };

    // Get the correct translation or default to Arabic if not provided
    const translation = translations[lang] || "ar.alafasy";

    const url = `https://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${translation}`;

    // Fetch Ayah data
    const response = await axios.get(url);
    const data = response.data;

    if (data.code === 200 && data.status === "OK") {
      // Add the dynamic image URL to the response
      const verseImage = `https://cdn.islamic.network/quran/images/${surahNumber}_${verseNumber}.png`;
      data.data.verseImage = verseImage;

      return res.status(200).json(data);
    } else {
      return res.status(data.code || 500).json(data);
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error.message);
    return res.status(500).json({
      code: 500,
      status: "Error",
      message: "Failed to fetch Quran data",
      error: error.message,
    });
  }
};



export const getSurahs = async (req, res) => {
  const url = "http://api.alquran.cloud/v1/surah";

  try {
    const response = await axios.get(url);
    const data = response.data; // axios already parses the JSON

    if (data.code === 200 && data.status === "OK") {
      res.status(200).json(data);
    } else {
      res.status(data.code || 500).json(data);
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error);
    res
      .status(500)
      .json({
        code: 500,
        status: "Error",
        message: "Failed to fetch Quran data",
      });
  }
};
export const getSurahByNumber = async (req, res) => {
  const { surahNumber } = req.params;

  if (!surahNumber) {
    return res
      .status(400)
      .json({
        code: 400,
        status: "Error",
        message: "Missing surahNumber parameter",
      });
  }

  const url = `http://api.alquran.cloud/v1/surah/${surahNumber}`;

  try {
    const response = await axios.get(url);
    const data = response.data; // axios already parses the JSON

    if (data.code === 200 && data.status === "OK") {
      res.status(200).json(data);
    } else {
      res.status(data.code || 500).json(data);
    }
  } catch (error) {
    console.error("Error fetching Quran data:", error);
    res
      .status(500)
      .json({
        code: 500,
        status: "Error",
        message: "Failed to fetch Quran data",
      });
  }
};

export const getAudio = async (req, res) => {
  try {
    const { reciter, number } = req.params;
    const [surahNumber, verseNumber] = number.split(":");
    if (!reciter) {
      return res
        .status(400)
        .json({
          code: 400,
          status: "Error",
          message: "Missing reciter parameter",
        });
    }
    if (!surahNumber || !verseNumber) {
      return res
        .status(400)
        .json({
          code: 400,
          status: "Error",
          message: "Invalid ayah format. Use 'surahNumber:verseNumber'",
        });
    }
    const audioUrl = `https://everyayah.com/data/${reciter}/${surahNumber.padStart(3, "0")}${verseNumber.padStart(3, "0")}.mp3`;

    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });

    if (response.status === 200) {
      res.set('Content-Type', 'audio/mpeg');
      res.send(response.data);
    } else {
      res.status(response.status).json({ code: response.status, status: "Error", message: "Failed to fetch audio" });
    }
  } catch (error) {
    console.error("Error fetching Quran audio:", error);
    res.status(500).json({ code: 500, status: "Error", message: "Failed to fetch Quran audio" });
  }
};
export const getReciters = async (req, res) => {
  res.json(reciters);
};
export const getEditions = async (req, res) => {
  res.json(editions);
};
export const paraImages = async (req, res) => {
  try {
    const { pageNo } = req.params;
    if (!pageNo) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Missing page parameter. Use '/paraNumber:pageNumber'",
      });
    }

    const [paraNumber, pageNumber] = pageNo.split(":");

    if (!paraNumber || !pageNumber || isNaN(paraNumber) || isNaN(pageNumber)) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Invalid format. Use 'paraNumber:pageNumber' with numbers only.",
      });
    }

    const url = `${process.env.IMAGEKIT_URL}/para-images/Para-${paraNumber}/${pageNumber}.png`;
    res.status(200).json({ url });
  } catch (error) {
    console.error("Error fetching para images:", error);
    res.status(500).json({
      code: 500,
      status: "Error",
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const surahImages = async (req, res) => {
  try {
    const { pageNo } = req.params;
    if (!pageNo) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Missing page parameter. Use '/surahNumber:pageNumber'",
      });
    }

    const [surahNumber, pageNumber] = pageNo.split(":");

    if (!surahNumber || !pageNumber || isNaN(surahNumber) || isNaN(pageNumber)) {
      return res.status(400).json({
        code: 400,
        status: "Error",
        message: "Invalid format. Use 'surahNumber:pageNumber' with numbers only.",
      });
    }

    const surah = surahs.find((s) => s.number === parseInt(surahNumber));

    if (!surah) {
      return res.status(404).json({
        code: 404,
        status: "Error",
        message: "Surah not found. Please enter a valid Surah number.",
      });
    }

    const surahName = `${surahNumber}.${surah.name.replace(/\s+/g, "-").replace(/'/g, "")}`; // Format name for URL
    const url = `${process.env.IMAGEKIT_URL}/surah-images/${surahName}/${pageNumber}.png`;

    res.status(200).json({ url });
  } catch (error) {
    console.error("Error fetching surah images:", error);
    res.status(500).json({
      code: 500,
      status: "Error",
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getQuran = async (req, res) => {
  try {
    res.status(200).json(quran);
  } catch (error) {
    console.error("Error fetching Quran data:", error);
    res
      .status(500)
      .json({
        code: 500,
        status: "Error",
        message: "Failed to fetch Quran data",
      });

  }
};