// pages/api/auth/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabaseServer from '../../../lib/supabaseServer';
import { setTokenCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;
  const { data: user, error } = await supabaseServer
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  debugger;
  setTokenCookie(res, token);
  res.json({ message: 'ok' });
}
