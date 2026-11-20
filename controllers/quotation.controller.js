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
    const { status, partyId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (partyId) query.party = partyId;

    const quotations = await Quotation.find(query)
      .populate('party', 'name phone email address')
      .populate('site', 'name siteNumber status')
      .sort({ createdAt: -1 });

    res.status(200).json(quotations);
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

    const totals = calculateTotals(items, discount, taxEnabled, taxRate);
    const quotationNumber = await generateNextNumber(Quotation, 'QTN', 'quotationNumber');

    const quotation = await Quotation.create({
      quotationNumber,
      party,
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

    const populated = await Quotation.findById(quotation._id).populate('party');
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

    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      {
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
      },
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
    const quotation = await Quotation.findById(req.params.id).populate('party');
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    quotation.status = 'approved';

    // If site is not yet created for this quotation, auto-create Site
    if (!quotation.siteCreated) {
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
      message: 'Quotation approved and site created successfully',
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
