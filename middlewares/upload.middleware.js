const fs = require('fs');
const path = require('path');
const multer = require('multer');

const CHALLAN_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'challans');
const QR_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'qr');

// Ensure upload directories exist at startup
fs.mkdirSync(CHALLAN_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(QR_UPLOAD_DIR, { recursive: true });

const createDiskStorage = (dir, prefix) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
  });

const imageFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ];
  if (allowedMimes.includes((file.mimetype || '').toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WEBP, GIF, HEIC) are allowed for challan photos'));
  }
};

const challanUpload = multer({
  storage: createDiskStorage(CHALLAN_UPLOAD_DIR, 'challan'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

const qrUpload = multer({
  storage: createDiskStorage(QR_UPLOAD_DIR, 'qr'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

// Express middleware wrappers so multer errors return clean 400 JSON
const uploadChallanImage = (req, res, next) => {
  challanUpload.single('challanImage')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid challan image upload' });
    }
    next();
  });
};

const uploadQrImage = (req, res, next) => {
  qrUpload.single('qrCodeImage')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid QR code image upload' });
    }
    next();
  });
};

module.exports = {
  uploadChallanImage,
  uploadQrImage,
  CHALLAN_UPLOAD_DIR,
  QR_UPLOAD_DIR,
};
