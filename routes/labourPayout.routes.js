const express = require('express');
const {
  getWeeklySettlementSummary,
  processWeeklyPayout,
  deletePayout,
  getPayoutHistory,
} = require('../controllers/labourPayout.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect);

// Viewing history is open to logged-in users
router.get('/history', getPayoutHistory);

// Processing weekly payouts & reversals is strictly Admin
router.get('/summary', authorize(ROLES.ADMIN), getWeeklySettlementSummary);
router.post('/pay', authorize(ROLES.ADMIN), processWeeklyPayout);
router.delete('/:id', authorize(ROLES.ADMIN), deletePayout);

module.exports = router;
