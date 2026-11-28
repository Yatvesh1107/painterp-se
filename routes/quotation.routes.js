const express = require('express');
const {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  approveQuotation,
  updateQuotationStatus,
  deleteQuotation,
} = require('../controllers/quotation.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.route('/').get(getQuotations).post(createQuotation);
router.route('/:id').get(getQuotationById).put(updateQuotation).delete(deleteQuotation);
router.route('/:id/approve').post(approveQuotation);
router.route('/:id/status').patch(updateQuotationStatus).put(updateQuotationStatus);

module.exports = router;
