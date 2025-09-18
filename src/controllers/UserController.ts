import { NextFunction, Request, Response } from "express";
import pool from "../config/db";

export const someUserFunction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pool.query('SELECT NOW()'); 
    res.status(200).json({
      message: "Successfully connected to DB and fetched time!",
      currentTime: result.rows[0].now, 
    });

  } catch (error) {
    console.error('Database query error:', error);
    next(error);
  }
};