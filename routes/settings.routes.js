const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, updateSettings);

module.exports = router;
