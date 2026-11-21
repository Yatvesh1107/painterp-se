const express = require('express');
const {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
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

router.route('/').get(getSites).post(createSite);
router.route('/:id').get(getSiteById).put(updateSite).delete(deleteSite);

// Site Expenses & Profit/Loss routes
router.route('/:siteId/expenses').get(getSiteExpenses).post(addSiteExpense);
router.route('/:siteId/expenses/:expenseId').delete(deleteSiteExpense);
router.route('/:siteId/profit-loss').get(getSiteProfitLoss);

module.exports = router;
