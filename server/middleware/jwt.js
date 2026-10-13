const jwt = require('jsonwebtoken');

const JWT_TTL = '8h';

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
}

function signAccessToken(user) {
  return jwt.sign({ userId: user.user_id, email: user.email, role: user.role }, secret(), {
    algorithm: 'HS256',
    expiresIn: JWT_TTL,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] });
}

module.exports = { signAccessToken, verifyAccessToken, JWT_TTL };
