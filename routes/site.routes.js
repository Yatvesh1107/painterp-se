const express = require('express');
const {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
  assignOrUpdateSubcontractor,
  addSubcontractorPayment,
  deleteSubcontractorPayment,
  removeSubcontractor,
  getSubcontractors,
} = require('../controllers/site.controller');
const {
  addSiteExpense,
  getSiteExpenses,
  deleteSiteExpense,
  getSiteProfitLoss,
} = require('../controllers/siteExpense.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/subcontractors/overview').get(getSubcontractors);

router.route('/').get(getSites).post(createSite);
router.route('/:id').get(getSiteById).put(updateSite).delete(deleteSite);

// Subcontractor & Lumpsum Installments routes
router
  .route('/:id/subcontractor')
  .put(assignOrUpdateSubcontractor)
  .delete(removeSubcontractor);
router.route('/:id/subcontractor/payments').post(addSubcontractorPayment);
router
  .route('/:id/subcontractor/payments/:paymentId')
  .delete(deleteSubcontractorPayment);

// Site Expenses & Profit/Loss routes
router.route('/:siteId/expenses').get(getSiteExpenses).post(addSiteExpense);
router.route('/:siteId/expenses/:expenseId').delete(deleteSiteExpense);
router.route('/:siteId/profit-loss').get(getSiteProfitLoss);

module.exports = router;
