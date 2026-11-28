const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');
const { jwtSecret, jwtExpiresIn } = require('../config/config');

const login = async (req, res) => {
  try {
    const { email, phone, identifier, username, password } = req.body;
    const input = (identifier || phone || email || username || '').trim();

    if (!input || !password) {
      return res.status(400).json({ message: 'Phone/Email and password are required' });
    }

    const cleanDigits = input.replace(/\D/g, '');
    let account = null;

    if (cleanDigits.length >= 10) {
      account = await Account.findOne({
        $or: [
          { phone: cleanDigits },
          { phone: input },
          { email: input.toLowerCase() },
        ],
      }).select('+password');
    } else {
      account = await Account.findOne({ email: input.toLowerCase() }).select('+password');
    }

    if (!account || !(await bcrypt.compare(password, account.password))) {
      return res.status(401).json({ message: 'Invalid phone/email or password' });
    }

    if (!account.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const token = jwt.sign({ id: account._id, role: account.role }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    account.lastLoginAt = new Date();
    await account.save();

    res.status(200).json({
      token,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: account.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMe = (req, res) => {
  res.status(200).json(req.account);
};

module.exports = { login, getMe };
