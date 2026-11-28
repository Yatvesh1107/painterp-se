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
  updateSiteExpense,
  getSiteExpenses,
  deleteSiteExpense,
  getSiteProfitLoss,
} = require('../controllers/siteExpense.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { uploadChallanImage } = require('../middlewares/upload.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect);

// Supervisors need read-only access to active sites list
router.get('/', getSites);

// All other site, subcontractor & expense operations are Admin-only
router.use(authorize(ROLES.ADMIN));

router.route('/subcontractors/overview').get(getSubcontractors);

router.route('/').post(createSite);
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
router
  .route('/:siteId/expenses')
  .get(getSiteExpenses)
  .post(uploadChallanImage, addSiteExpense);
router
  .route('/:siteId/expenses/:expenseId')
  .put(uploadChallanImage, updateSiteExpense)
  .delete(deleteSiteExpense);
router.route('/:siteId/profit-loss').get(getSiteProfitLoss);

module.exports = router;
