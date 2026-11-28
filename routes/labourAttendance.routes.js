const express = require('express');
const {
  getDailyAttendance,
  saveDailyAttendance,
  copyFromPreviousDay,
  getAttendanceHistory,
} = require('../controllers/labourAttendance.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/roster', getDailyAttendance);
router.post('/save', saveDailyAttendance);
router.post('/copy', copyFromPreviousDay);
router.get('/history', getAttendanceHistory);

module.exports = router;
