const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never returned by queries unless explicitly selected with +password.
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.ADMIN,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

accountSchema.methods.toJSON = function () {
  const account = this.toObject();
  delete account.password;
  return account;
};

module.exports = mongoose.model('Account', accountSchema);
