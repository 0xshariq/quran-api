import express from "express"
import dotenv from "dotenv"
import quranRouter from "./routes/quran.js"
import userRouter from "./routes/user.js"
import { connectToDatabase } from "./db/database.js"
import { apiKeyMiddleware } from "./middlewares/apiKeyMiddleware.js"
import { errorMiddleware } from "./middlewares/error.js"
import cors from "cors"
import path from "path"
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import compression from "compression";
import morgan from "morgan";

// Load environment variables
dotenv.config({ path: "./config.env" })

const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
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
// Security Middleware
app.use(helmet()); // Adds security headers
app.use(mongoSanitize()); // Prevents MongoDB injection attacks
app.use(compression());
// Rate Limiting - Prevents abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// Logging Middleware
app.use(morgan("dev"));
// Routes
app.use("/api/v2/users", userRouter)
app.use("/api/v2/quran", apiKeyMiddleware, quranRouter)

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the Quran API");
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

