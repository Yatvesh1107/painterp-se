const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { uploadQrImage } = require('../middlewares/upload.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, authorize(ROLES.ADMIN), uploadQrImage, updateSettings);

module.exports = router;
