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

    res.status(201).json(response.data)
  } catch (error) {
    console.error("Error during user registration:", error.response?.data || error.message)
    next(new ErrorHandler(error.response?.status || 500, error.response?.data?.message || "Error during registration"))
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

    // Forward the Set-Cookie header if present
    if (response.headers["set-cookie"]) {
      res.setHeader("Set-Cookie", response.headers["set-cookie"])
    }

    res.status(200).json(response.data)
  } catch (error) {
    console.error("Error during user login:", error.response?.data || error.message)
    next(
      new ErrorHandler(
        error.response?.status || 500,
        error.response?.data?.message || "Internal server error during login",
      ),
    )
  }
}

export const logoutUser = async (req, res, next) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/logout`, {
      headers: {
        Cookie: req.headers.cookie,
      },
    })

    // Forward the Set-Cookie header to clear the cookie
    if (response.headers["set-cookie"]) {
      res.setHeader("Set-Cookie", response.headers["set-cookie"])
    }

    res.status(200).json(response.data)
  } catch (error) {
    console.error("Error during user logout:", error.response?.data || error.message)
    next(new ErrorHandler(error.response?.status || 500, error.response?.data?.message || "Error during logout"))
  }
}

