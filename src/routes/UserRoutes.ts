import express from "express";
import { someUserFunction } from "../controllers/UserController";

const router = express.Router();

router.get("/", someUserFunction);


export default router;