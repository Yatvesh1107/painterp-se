const mongoose = require('mongoose');

const shiftAllocationSchema = new mongoose.Schema({
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
  },
  shiftType: {
    type: String,
    enum: ['full_day', 'half_day'],
    default: 'full_day',
  },
  halfSlot: {
    type: String,
    enum: ['first_half', 'second_half', 'full_day'],
    default: 'full_day',
  },
  units: {
    type: Number,
    required: true,
    min: 0.1,
    max: 1.0,
    default: 1.0,
  },
  wageAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
});

const labourAttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    dateString: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    labour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Labour',
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'present', 'full_day', 'half_day', 'absent'],
      default: 'scheduled',
    },
    shifts: [shiftAllocationSchema],
    totalUnits: {
      type: Number,
      default: 0,
    },
    totalWageAmount: {
      type: Number,
      default: 0,
    },
    advanceAmount: {
      type: Number,
      default: 0,
    },
    advancePaymentMode: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'other'],
      default: 'cash',
    },
    advanceNotes: {
      type: String,
      trim: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    payoutRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourPayout',
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  { timestamps: true }
);

labourAttendanceSchema.index({ labour: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('LabourAttendance', labourAttendanceSchema);
