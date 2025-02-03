import express from "express"
import { getQuran } from "../controllers/getQuran.js"

const router = express.Router()

// Update the route to use a wildcard parameter
router.get("/:ayah(*)", getQuran)

export default router

