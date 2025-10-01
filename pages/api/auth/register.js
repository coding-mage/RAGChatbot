// pages/api/auth/register.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabaseServer from '../../../lib/supabaseServer';
import { setTokenCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing' });

  const hash = await bcrypt.hash(password, 10);
  console.log(email, password)
  const { data, error } = await supabaseServer
    .from('users')
    .insert([{ email, password_hash: hash }])
    .select()
    .single();
  console.log(error)
  if (error) return res.status(400).json({ error: error.message });

  const token = jwt.sign({ id: data.id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  setTokenCookie(res, token);
  res.status(201).json({ user: { id: data.id, email: data.email } });
}
