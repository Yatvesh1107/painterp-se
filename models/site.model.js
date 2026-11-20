const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema(
  {
    siteNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'on_hold'],
      default: 'in_progress',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    estimatedCost: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Site', siteSchema);
