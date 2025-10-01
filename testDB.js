import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.SUPABASE_SERVICE_ROLE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', res.rows[0]);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  } finally {
    await pool.end();
  }
})();
