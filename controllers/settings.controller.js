const fs = require('fs');
const path = require('path');
const Settings = require('../models/settings.model');

const removeUploadedFile = (relativeUrl) => {
  if (!relativeUrl || !relativeUrl.startsWith('/uploads/')) return;
  const fullPath = path.join(__dirname, '..', relativeUrl.replace(/^\//, ''));
  fs.unlink(fullPath, () => {});
};

// Get current system settings or create default if not exists
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update system settings
const updateSettings = async (req, res) => {
  const uploadedQrPath = req.file ? `/uploads/qr/${req.file.filename}` : null;

  try {
    const updatePayload = { ...req.body };
    if (uploadedQrPath) {
      updatePayload.qrCodeImage = uploadedQrPath;
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(updatePayload);
    } else {
      const previousQr = settings.qrCodeImage;
      Object.assign(settings, updatePayload);
      await settings.save();

      // Clean up old uploaded QR image if replaced or cleared
      if (
        previousQr &&
        previousQr.startsWith('/uploads/') &&
        (uploadedQrPath || updatePayload.qrCodeImage === '')
      ) {
        removeUploadedFile(previousQr);
      }
    }
    res.status(200).json(settings);
  } catch (error) {
    if (uploadedQrPath) removeUploadedFile(uploadedQrPath);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
