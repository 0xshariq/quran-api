import axios from "axios"
import ErrorHandler from "../middlewares/error.js"

const API_BASE_URL = "https://user-authentication-api-jqfm.onrender.com/api/v2/users"

export const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return next(new ErrorHandler(400, "All fields are required"))
    }

    const response = await axios.post(`${API_BASE_URL}/register`, {
      name,
      email,
      password,
    })

    // Check if the API response contains a token
    const { token } = response.data

    if (!token) {
      return next(new ErrorHandler(500, "Token not received from authentication server"))
    }

    res
      .status(201)
      .cookie("token", token, {
        httpOnly: true,
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
        secure: process.env.NODE_ENV === "development" ? false : true,
      })
      .json({
        success: true,
        message: "User registered successfully",
      })
  } catch (error) {
    handleApiError(error, next)
  }
}

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return next(new ErrorHandler(400, "Email and password are required"))
    }

    const response = await axios.post(`${API_BASE_URL}/login`, {
      email,
      password,
    })

    // Check if the API response contains a token
    const { token } = response.data

    if (!token) {
      return next(new ErrorHandler(500, "Token not received from authentication server"))
    }

    res
      .status(200)
      .cookie("token", token, {
        httpOnly: true,
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
        secure: process.env.NODE_ENV === "development" ? false : true,
      })
      .json({
        success: true,
        message: "Login successful",
      })
  } catch (error) {
    handleApiError(error, next)
  }
}

export const logoutUser = async (req, res, next) => {
  try {
    res
      .status(200)
      .clearCookie("token", {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
        secure: process.env.NODE_ENV === "development" ? false : true,
      })
      .json({
        success: true,
        message: "Logout successful",
      })
  } catch (error) {
    next(new ErrorHandler(500, "Error during logout"))
  }
}

function handleApiError(error, next) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    next(new ErrorHandler(error.response.status, error.response.data.message || "Error from authentication server"))
  } else if (error.request) {
    // The request was made but no response was received
    next(new ErrorHandler(500, "No response received from authentication server"))
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error("Error", error.message)
    next(new ErrorHandler(500, "Error during API request"))
  }
}

