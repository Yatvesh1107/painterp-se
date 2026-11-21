const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentNumber: {
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
      enum: ['cash', 'upi', 'bank_transfer', 'cheque'],
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

const invoiceItemSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    serviceName: {
      type: String,
      trim: true,
    },
    calculationType: {
      type: String,
      enum: ['direct', 'dimensions'],
      default: 'direct',
    },
    dimensions: {
      length: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      quantity: { type: Number, default: 1 },
      deduction: { type: Number, default: 0 },
    },
    areaSqFt: {
      type: Number,
      default: 0,
    },
    rate: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    items: [invoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    taxEnabled: {
      type: Boolean,
      default: false,
    },
    taxRate: {
      type: Number,
      default: 18,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    payments: [paymentRecordSchema],
    paidAmount: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'cancelled'],
      default: 'issued',
    },
    terms: {
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

module.exports = mongoose.model('Invoice', invoiceSchema);
