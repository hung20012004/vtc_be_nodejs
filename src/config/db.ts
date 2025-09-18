// src/config/db.ts

import { Pool } from 'pg';
import 'dotenv/config'; 

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

pool.on('connect', () => {
  console.log('🔌 Connected to the PostgreSQL database!');
});

export default pool;