const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    serviceName: {
      type: String,
      required: true,
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
      required: true,
      min: 0,
      default: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
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
    title: {
      type: String,
      trim: true,
      default: 'Painting Work Quotation',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    items: [quotationItemSchema],
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
    terms: {
      type: String,
      default:
        '1. 50% advance along with work order.\n2. 40% running payment during work progress.\n3. 10% balance upon final completion.\n4. Quotation valid for 30 days.',
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'rejected'],
      default: 'draft',
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
    },
    siteCreated: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quotation', quotationSchema);
