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
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getQuotations).post(createQuotation);
router.route('/:id').get(getQuotationById).put(updateQuotation).delete(deleteQuotation);
router.route('/:id/approve').post(approveQuotation);
router.route('/:id/status').patch(updateQuotationStatus).put(updateQuotationStatus);

module.exports = router;
