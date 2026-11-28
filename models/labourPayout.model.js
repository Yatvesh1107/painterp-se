const mongoose = require('mongoose');

const siteWageSplitSchema = new mongoose.Schema({
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
  },
  days: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  siteExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SiteExpense',
  },
});

const labourPayoutSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    payoutDate: {
      type: Date,
      default: Date.now,
    },
    labour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Labour',
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      default: 0,
    },
    dailyWage: {
      type: Number,
      required: true,
    },
    grossWages: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAdvances: {
      type: Number,
      default: 0,
    },
    netPaidAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
      default: 'cash',
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    siteBreakdown: [siteWageSplitSchema],
    attendanceRecords: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabourAttendance',
      },
    ],
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LabourPayout', labourPayoutSchema);
