const Quotation = require('../models/quotation.model');
const Site = require('../models/site.model');
const Party = require('../models/party.model');
const { generateNextNumber } = require('../utils/generateNumber');

// Calculate item and quotation totals
const calculateTotals = (items = [], discount = 0, taxEnabled = false, taxRate = 18) => {
  let subtotal = 0;

  const processedItems = items.map((item) => {
    let areaSqFt = Number(item.areaSqFt) || 0;

    // If dimensions are provided (Length x Height x Quantity - Deduction)
    if (item.calculationType === 'dimensions' && item.dimensions) {
      const length = Number(item.dimensions.length) || 0;
      const height = Number(item.dimensions.height) || 0;
      const quantity = Number(item.dimensions.quantity) || 1;
      const deduction = Number(item.dimensions.deduction) || 0;

      areaSqFt = Math.max(0, length * height * quantity - deduction);
    }

    const rate = Number(item.rate) || 0;
    const amount = Math.round(areaSqFt * rate * 100) / 100;
    subtotal += amount;

    return {
      ...item,
      areaSqFt,
      rate,
      amount,
    };
  });

  const numDiscount = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - numDiscount);
  const numTaxRate = Number(taxRate) || 18;
  const taxAmount = taxEnabled ? Math.round((taxableAmount * numTaxRate) / 100 * 100) / 100 : 0;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    items: processedItems,
    subtotal,
    discount: numDiscount,
    taxEnabled: Boolean(taxEnabled),
    taxRate: numTaxRate,
    taxAmount,
    totalAmount,
  };
};

const getQuotations = async (req, res) => {
  try {
    const { status, partyId, siteId, search, page, limit } = req.query;
    let query = {};

    if (status && status !== 'all') query.status = status;
    if (partyId) query.party = partyId;
    if (siteId) query.site = siteId;

    if (search && search.trim()) {
      const s = search.trim();
      const matchingParties = await Party.find({ name: { $regex: s, $options: 'i' } }).select('_id');
      const partyIds = matchingParties.map((p) => p._id);

      query.$or = [
        { quotationNumber: { $regex: s, $options: 'i' } },
        { title: { $regex: s, $options: 'i' } },
        { party: { $in: partyIds } },
      ];
    }

    // Check which quotations already have invoices created
    const Invoice = require('../models/invoice.model');
    const existingInvoices = await Invoice.find({ quotation: { $ne: null } }).select('quotation invoiceNumber');
    const invoicedMap = new Map();
    existingInvoices.forEach((inv) => {
      if (inv.quotation) {
        invoicedMap.set(inv.quotation.toString(), inv.invoiceNumber);
      }
    });

    const enrichQuotations = (items) =>
      items.map((q) => {
        const plain = q.toObject();
        plain.isInvoiced = invoicedMap.has(q._id.toString());
        plain.invoiceNumber = invoicedMap.get(q._id.toString()) || null;
        return plain;
      });

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const total = await Quotation.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum) || 1;

      const quotations = await Quotation.find(query)
        .populate('party', 'name phone email address')
        .populate('site', 'name siteNumber address status')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.status(200).json({
        data: enrichQuotations(quotations),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    }

    const quotations = await Quotation.find(query)
      .populate('party', 'name phone email address')
      .populate('site', 'name siteNumber address status')
      .sort({ createdAt: -1 });

    res.status(200).json(enrichQuotations(quotations));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('party')
      .populate('site');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    res.status(200).json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createQuotation = async (req, res) => {
  try {
    const {
      party,
      site,
      title,
      date,
      validUntil,
      items,
      discount,
      taxEnabled,
      taxRate,
      terms,
    } = req.body;

    if (!party) {
      return res.status(400).json({ message: 'Party is required' });
    }

    if (!site) {
      return res.status(400).json({ message: 'Site is required. A quotation must be linked to a specific site.' });
    }

    const totals = calculateTotals(items, discount, taxEnabled, taxRate);
    const quotationNumber = await generateNextNumber(Quotation, 'QTN', 'quotationNumber');

    const quotation = await Quotation.create({
      quotationNumber,
      party,
      site,
      title: title || 'Painting Work Quotation',
      date: date || new Date(),
      validUntil,
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxEnabled: totals.taxEnabled,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      terms,
      status: 'draft',
      createdBy: req.account?._id,
    });

    const populated = await Quotation.findById(quotation._id)
      .populate('party')
      .populate('site');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateQuotation = async (req, res) => {
  try {
    const {
      title,
      party,
      site,
      date,
      validUntil,
      items,
      discount,
      taxEnabled,
      taxRate,
      terms,
      status,
    } = req.body;

    const totals = calculateTotals(items, discount, taxEnabled, taxRate);

    const updateData = {
      title,
      party,
      date,
      validUntil,
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxEnabled: totals.taxEnabled,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      terms,
      status,
    };
    if (site) updateData.site = site;

    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('party')
      .populate('site');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    res.status(200).json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve quotation & automatically create/link Site
const approveQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('party')
      .populate('site');
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    quotation.status = 'approved';

    // If quotation already has a site (standard flow), ensure site is linked
    if (quotation.site) {
      quotation.siteCreated = true;
      await Site.findByIdAndUpdate(quotation.site._id || quotation.site, {
        quotation: quotation._id,
      });
    } else {
      // Fallback for legacy quotations created before site selection was mandatory
      const siteNumber = await generateNextNumber(Site, 'SITE', 'siteNumber');
      const site = await Site.create({
        siteNumber,
        name: quotation.title || `${quotation.party?.name} Painting Site`,
        party: quotation.party._id,
        quotation: quotation._id,
        address: quotation.party?.address || '',
        status: 'in_progress',
        startDate: new Date(),
        estimatedCost: quotation.totalAmount,
        createdBy: req.account?._id,
      });

      quotation.site = site._id;
      quotation.siteCreated = true;
    }

    await quotation.save();
    const updated = await Quotation.findById(quotation._id)
      .populate('party')
      .populate('site');

    res.status(200).json({
      message: 'Quotation approved successfully',
      quotation: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    res.status(200).json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  approveQuotation,
  deleteQuotation,
};
