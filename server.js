import express from "express"
import dotenv from "dotenv"
import quranRouter from "./routes/quran.js"
import userRouter from "./routes/user.js"
import { connectToDatabase } from "./db/database.js"
import { apiKeyMiddleware } from "./middlewares/apiKeyMiddleware.js"
import cookieParser from "cookie-parser"
import { errorMiddleware } from "./middlewares/error.js"
import cors from "cors"
import path from "path"
import axios from "axios"

// Load environment variables
dotenv.config({ path: "./config.env" })

const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(
  cors({
    origin: ["http://localhost:3000", process.env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
)
const __dirname = path.resolve()
app.use(express.static(path.join(__dirname, "public")));
// Error handling middleware
app.use(errorMiddleware)

// Routes
app.use("/api/v2/users", userRouter)
app.use("/api/v2/quran", apiKeyMiddleware, quranRouter)

// Root route
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" })
});

app.get("/register", (req, res) => res.sendFile("register.html", { root: "./public" }));
app.get("/login", (req, res) => res.sendFile("login.html", { root: "./public" }));

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { data } = await axios.post("https://user-authentication-api-jqfm.onrender.com/api/v2/users/register", { name, email, password });
    res.cookie("token", data.token, { httpOnly: true });
    res.redirect("/login");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Registration failed.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data } = await axios.post("https://user-authentication-api-jqfm.onrender.com/api/v2/users/login", { email, password });
    res.cookie("token", data.token, { httpOnly: true });
    res.redirect("/");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(401).send("Login failed.");
  }
});

// Connect to database and start server
const startServer = async () => {
  try {
    await connectToDatabase()

    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
    })

  } catch (error) {
    console.error("Failed to start server:", error)
    // Implement appropriate error handling here
    // You might want to retry the connection or exit the process
    process.exit(1)
  }
}

startServer()

// Handle graceful shutdown
process.on("SIGINT", async () => {
  try {
    console.log("Shutting down gracefully...")
    process.exit(0)
  } catch (error) {
    console.error("Error during shutdown:", error)
    process.exit(1)
  }
})

