const mongoose = require('mongoose');

const subcontractorPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
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
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

const subcontractorSchema = new mongoose.Schema(
  {
    isAssigned: {
      type: Boolean,
      default: false,
    },
    subcontractorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcontractor',
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    workDescription: {
      type: String,
      trim: true,
    },
    agreedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
    },
    targetCompletionDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    notes: {
      type: String,
      trim: true,
    },
    payments: [subcontractorPaymentSchema],
    totalPaid: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

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
    subcontractor: {
      type: subcontractorSchema,
      default: () => ({
        isAssigned: false,
        name: '',
        phone: '',
        workDescription: '',
        agreedAmount: 0,
        status: 'active',
        payments: [],
        totalPaid: 0,
        balanceAmount: 0,
      }),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Site', siteSchema);
