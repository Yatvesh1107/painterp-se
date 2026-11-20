const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');
const { jwtSecret, jwtExpiresIn } = require('../config/config');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const account = await Account.findOne({ email: email.toLowerCase().trim() }).select(
      '+password'
    );

    if (!account || !(await bcrypt.compare(password, account.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
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
