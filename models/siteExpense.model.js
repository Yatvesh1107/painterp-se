const mongoose = require('mongoose');

const siteExpenseSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
      index: true,
    },
    expenseType: {
      type: String,
      enum: ['material', 'labour', 'transport_scaffolding', 'other'],
      default: 'material',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    vendorOrPerson: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'credit_due'],
      default: 'cash',
    },
    billNumber: {
      type: String,
      trim: true,
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

module.exports = mongoose.model('SiteExpense', siteExpenseSchema);
