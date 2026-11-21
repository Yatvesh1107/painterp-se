const express = require('express');
const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  addPayment,
  updatePayment,
  deletePayment,
  cancelInvoice,
  getStatementByParty,
  updateInvoice,
  deleteInvoice,
} = require('../controllers/invoice.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getInvoices).post(createInvoice);
router.route('/:id').get(getInvoiceById).put(updateInvoice).delete(deleteInvoice);
router.route('/:id/cancel').post(cancelInvoice);
router.route('/:id/payments').post(addPayment);
router.route('/:id/payments/:paymentId').put(updatePayment).delete(deletePayment);
router.route('/statement/party/:partyId').get(getStatementByParty);

module.exports = router;
