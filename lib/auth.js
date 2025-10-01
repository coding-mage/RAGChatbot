// lib/auth.js
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

export function setTokenCookie(res, token) {
  const cookieStr = cookie.serialize('token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });
  res.setHeader('Set-Cookie', cookieStr);
}

export function getUserFromReq(req) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;
    if (!token) throw new Error('No token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload; // { id, email, iat, exp }
  } catch (e) {
    return null;
  }
}
