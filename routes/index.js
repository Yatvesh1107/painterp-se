const express = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const partyRoutes = require('./party.routes');
const serviceRoutes = require('./service.routes');
const quotationRoutes = require('./quotation.routes');
const siteRoutes = require('./site.routes');
const invoiceRoutes = require('./invoice.routes');
const settingsRoutes = require('./settings.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/parties', partyRoutes);
router.use('/services', serviceRoutes);
router.use('/quotations', quotationRoutes);
router.use('/sites', siteRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
