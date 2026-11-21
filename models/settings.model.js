const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'SANJEEVANI ENTERPRISE',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'INTERNAL & EXTERNAL PAINTING',
      trim: true,
    },
    subTagline: {
      type: String,
      default: 'Bungalow, Apartment, Waterproof, Industrial',
      trim: true,
    },
    proprietor: {
      type: String,
      default: 'SACHIN HULSWAR\n(Proprietor)',
      trim: true,
    },
    phone: {
      type: String,
      default: '96 21 733 771',
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '27ADEPH0867P3ZY',
      trim: true,
    },
    address: {
      type: String,
      default: 'Plot #327/2, R. K. Nagar, Morewadi, Kolhapur',
      trim: true,
    },
    upiId: {
      type: String,
      default: '',
      trim: true,
    },
    qrCodeImage: {
      type: String, // base64 data URL or image URL
      default: '',
    },
    defaultTerms: {
      type: String,
      default:
        '1. Above invoice is excluding 18% GST.\n2. Payment of material should be made fully on same day after material is delivered.\n3. Advance payment should be made on every Saturday as per work completed.',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
