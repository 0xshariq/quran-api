import axios from "axios"

const AUTH_API_URL = "https://user-authentication-api-jqfm.onrender.com/api/v2"

export const apiKeyMiddleware = async (req, res, next) => {
  try {
    const apiKey = req.query.key || req.headers["x-api-key"]
    if (!apiKey) {
      return res.status(401).json({ message: "API key is missing" })
    }

    // Validate the API key with the authentication API
    const response = await axios.post(`${AUTH_API_URL}/apiKey/validate`, { apiKey })

    if (response.data.valid) {
      // If the API key is valid, attach the user info to the request
      req.user = response.data.user
      next()
    } else {
      res.status(403).json({ message: "Invalid API key" })
    }
  } catch (error) {
    console.error("Error validating API key:", error.response?.data || error.message)
    res.status(500).json({ message: "Error validating API key" })
  }
}

