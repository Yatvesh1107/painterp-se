const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');
const { jwtSecret } = require('../config/config');

const protect = async (req, res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Bearer token required' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const account = await Account.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }

    if (!account.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    req.account = account;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.account.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

module.exports = { protect, authorize };
