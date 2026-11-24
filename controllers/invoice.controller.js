const Invoice = require('../models/invoice.model');
const Party = require('../models/party.model');
const Site = require('../models/site.model');
const { generateNextNumber } = require('../utils/generateNumber');

// Calculate invoice subtotal, tax, and total (matching Quotation calculation)
const calculateInvoiceTotals = (items = [], discount = 0, taxEnabled = false, taxRate = 18) => {
  let subtotal = 0;

  const processedItems = items.map((item) => {
    let areaSqFt = Number(item.areaSqFt) || 0;

    // Support dimensions calculation (Length x Height x Quantity - Deduction)
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
      service: item.service || undefined,
      serviceName: item.serviceName || item.description || 'Painting Service',
      calculationType: item.calculationType || 'direct',
      dimensions: item.dimensions || { length: 0, height: 0, quantity: 1, deduction: 0 },
      areaSqFt,
      rate,
      amount,
      description: item.description || '',
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

const getInvoices = async (req, res) => {
  try {
    const { partyId, siteId, paymentStatus, status, search, page, limit } = req.query;
    let query = {};

    if (partyId) query.party = partyId;
    if (siteId) query.site = siteId;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    if (status && status !== 'all') query.status = status;

    if (search && search.trim()) {
      const s = search.trim();
      const [matchingParties, matchingSites] = await Promise.all([
        Party.find({ name: { $regex: s, $options: 'i' } }).select('_id'),
        Site.find({ name: { $regex: s, $options: 'i' } }).select('_id'),
      ]);

      query.$or = [
        { invoiceNumber: { $regex: s, $options: 'i' } },
        { party: { $in: matchingParties.map((p) => p._id) } },
        { site: { $in: matchingSites.map((st) => st._id) } },
      ];
    }

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const total = await Invoice.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum) || 1;

      const invoices = await Invoice.find(query)
        .populate('party', 'name phone email address')
        .populate('site', 'name siteNumber')
        .populate('quotation', 'quotationNumber')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.status(200).json({
        data: invoices,
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

    const invoices = await Invoice.find(query)
      .populate('party', 'name phone email address')
      .populate('site', 'name siteNumber')
      .populate('quotation', 'quotationNumber')
      .sort({ createdAt: -1 });

    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('party')
      .populate('site')
      .populate('quotation');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    const {
      party,
      site,
      quotation,
      invoiceDate,
      dueDate,
      items,
      discount,
      taxEnabled,
      taxRate,
      terms,
      notes,
    } = req.body;

    if (!party) {
      return res.status(400).json({ message: 'Party is required' });
    }

    // Validate quotation if provided
    let finalSite = site;
    if (quotation) {
      const Quotation = require('../models/quotation.model');
      const linkedQuote = await Quotation.findById(quotation);
      if (!linkedQuote) {
        return res.status(404).json({ message: 'Linked quotation not found' });
      }

      // Financial Edge Case: Quotation must be approved to be invoiced
      if (linkedQuote.status !== 'approved') {
        return res.status(400).json({
          message: `Cannot invoice quotation with status '${linkedQuote.status}'. Quotation must be 'approved' before generating an invoice.`,
        });
      }

      // Financial Edge Case: Prevent duplicate billing of same quotation
      const existingInvoice = await Invoice.findOne({
        quotation,
        status: { $ne: 'cancelled' },
      });
      if (existingInvoice) {
        return res.status(400).json({
          message: `Quotation is already invoiced under Invoice #${existingInvoice.invoiceNumber}. Duplicate billing is prevented.`,
        });
      }

      finalSite = site || linkedQuote.site;
    }

    const totals = calculateInvoiceTotals(items, discount, taxEnabled, taxRate);
    const invoiceNumber = await generateNextNumber(Invoice, 'INV', 'invoiceNumber');

    const invoice = await Invoice.create({
      invoiceNumber,
      party,
      site: finalSite,
      quotation,
      invoiceDate: invoiceDate || new Date(),
      dueDate,
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxEnabled: totals.taxEnabled,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      paidAmount: 0,
      balanceAmount: totals.totalAmount,
      paymentStatus: 'unpaid',
      terms,
      notes,
      createdBy: req.account?._id,
    });

    const populated = await Invoice.findById(invoice._id)
      .populate('party')
      .populate('site')
      .populate('quotation');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add payment to an invoice (supports multiple payments on single invoice)
const addPayment = async (req, res) => {
  try {
    const { amount, date, paymentMode, referenceNumber, notes } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot record payment on a cancelled invoice.' });
    }

    // Financial Edge Case: Prevent overpaying more than invoice balance
    if (numAmount > invoice.balanceAmount) {
      return res.status(400).json({
        message: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds remaining invoice balance of ₹${invoice.balanceAmount.toLocaleString('en-IN')}. Overpayment is prevented.`,
      });
    }

    const paymentIndex = (invoice.payments?.length || 0) + 1;
    const paymentNumber = `PAY-${invoice.invoiceNumber}-${String(paymentIndex).padStart(2, '0')}`;

    invoice.payments.push({
      paymentNumber,
      amount: numAmount,
      date: date || new Date(),
      paymentMode: paymentMode || 'cash',
      referenceNumber,
      notes,
      recordedBy: req.account?._id,
    });

    // Recalculate paid amount and balance
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    invoice.paidAmount = Math.round(totalPaid * 100) / 100;
    invoice.balanceAmount = Math.max(0, Math.round((invoice.totalAmount - invoice.paidAmount) * 100) / 100);

    if (invoice.balanceAmount <= 0) {
      invoice.paymentStatus = 'paid';
    } else if (invoice.paidAmount > 0) {
      invoice.paymentStatus = 'partially_paid';
    } else {
      invoice.paymentStatus = 'unpaid';
    }

    await invoice.save();

    const updated = await Invoice.findById(invoice._id)
      .populate('party')
      .populate('site')
      .populate('quotation');

    res.status(200).json({
      message: 'Payment recorded successfully',
      invoice: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit / update existing payment on invoice
const updatePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { amount, date, paymentMode, referenceNumber, notes } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const pay = invoice.payments.id(paymentId);
    if (!pay) return res.status(404).json({ message: 'Payment record not found' });

    if (amount !== undefined) {
      const newAmt = Number(amount);
      if (!newAmt || newAmt <= 0) return res.status(400).json({ message: 'Valid payment amount is required' });

      // Check against total balance excluding this payment
      const otherPayments = invoice.payments.filter((p) => p._id.toString() !== paymentId);
      const otherPaid = otherPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (otherPaid + newAmt > invoice.totalAmount) {
        return res.status(400).json({
          message: `Updated payment exceeds total invoice amount of ₹${invoice.totalAmount}`,
        });
      }
      pay.amount = newAmt;
    }

    if (date) pay.date = date;
    if (paymentMode) pay.paymentMode = paymentMode;
    if (referenceNumber !== undefined) pay.referenceNumber = referenceNumber;
    if (notes !== undefined) pay.notes = notes;

    const totalPaid = invoice.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    invoice.paidAmount = Math.round(totalPaid * 100) / 100;
    invoice.balanceAmount = Math.max(0, Math.round((invoice.totalAmount - invoice.paidAmount) * 100) / 100);
    invoice.paymentStatus = invoice.balanceAmount <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partially_paid' : 'unpaid';

    await invoice.save();
    const updated = await Invoice.findById(id).populate('party').populate('site').populate('quotation');
    res.status(200).json({ message: 'Payment updated successfully', invoice: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete / reverse payment on invoice
const deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.payments.pull({ _id: paymentId });

    const totalPaid = invoice.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    invoice.paidAmount = Math.round(totalPaid * 100) / 100;
    invoice.balanceAmount = Math.max(0, Math.round((invoice.totalAmount - invoice.paidAmount) * 100) / 100);
    invoice.paymentStatus = invoice.balanceAmount <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partially_paid' : 'unpaid';

    await invoice.save();
    const updated = await Invoice.findById(id).populate('party').populate('site').populate('quotation');
    res.status(200).json({ message: 'Payment deleted/reversed successfully', invoice: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel an invoice (voids debit obligations & frees quotation)
const cancelInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    invoice.status = 'cancelled';
    await invoice.save();

    const updated = await Invoice.findById(invoice._id)
      .populate('party')
      .populate('site')
      .populate('quotation');

    res.status(200).json({
      message: 'Invoice cancelled successfully',
      invoice: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Statement of Account / Ledger by Party (with optional siteId filter)
const getStatementByParty = async (req, res) => {
  try {
    const { partyId } = req.params;
    const { siteId } = req.query;

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    // Fetch all sites belonging to this client/party
    const sites = await Site.find({ party: partyId }).sort({ createdAt: -1 });

    // Build invoice query
    const invoiceQuery = { party: partyId };
    if (siteId && siteId !== 'all') {
      invoiceQuery.site = siteId;
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('site', 'name siteNumber address status')
      .sort({ invoiceDate: 1 });

    let totalBilled = 0;
    let totalPaid = 0;
    const paymentsList = [];
    const invoiceBreakdown = [];

    invoices.forEach((inv) => {
      // Financial Edge Case: Cancelled invoices have 0 active debit or ledger impact
      const isCancelled = inv.status === 'cancelled';
      if (!isCancelled) {
        totalBilled += inv.totalAmount;
        totalPaid += inv.paidAmount;
      }

      const invPayments = [];
      (inv.payments || []).forEach((pay) => {
        const payObj = {
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          paymentNumber: pay.paymentNumber,
          amount: pay.amount,
          date: pay.date,
          paymentMode: pay.paymentMode,
          referenceNumber: pay.referenceNumber,
          notes: pay.notes,
        };
        invPayments.push(payObj);
        if (!isCancelled) {
          paymentsList.push(payObj);
        }
      });

      invoiceBreakdown.push({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        site: inv.site,
        status: inv.status,
        paymentStatus: inv.paymentStatus,
        subtotal: inv.subtotal,
        discount: inv.discount,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        payments: invPayments,
      });
    });

    // Sort payments chronologically
    paymentsList.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalOutstanding = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

    let selectedSite = null;
    if (siteId && siteId !== 'all') {
      selectedSite = sites.find((s) => s._id.toString() === siteId.toString()) || null;
    }

    res.status(200).json({
      party,
      sites,
      selectedSite,
      summary: {
        totalInvoices: invoices.filter((i) => i.status !== 'cancelled').length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding,
      },
      invoices,
      payments: paymentsList,
      invoiceBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { items, discount, taxEnabled, taxRate, dueDate, terms, notes, status } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const totals = calculateInvoiceTotals(items, discount, taxEnabled, taxRate);

    invoice.items = totals.items;
    invoice.subtotal = totals.subtotal;
    invoice.discount = totals.discount;
    invoice.taxEnabled = totals.taxEnabled;
    invoice.taxRate = totals.taxRate;
    invoice.taxAmount = totals.taxAmount;
    invoice.totalAmount = totals.totalAmount;
    invoice.balanceAmount = Math.max(0, Math.round((totals.totalAmount - invoice.paidAmount) * 100) / 100);
    if (dueDate) invoice.dueDate = dueDate;
    if (terms !== undefined) invoice.terms = terms;
    if (notes !== undefined) invoice.notes = notes;
    if (status) invoice.status = status;

    if (invoice.balanceAmount <= 0) {
      invoice.paymentStatus = 'paid';
    } else if (invoice.paidAmount > 0) {
      invoice.paymentStatus = 'partially_paid';
    } else {
      invoice.paymentStatus = 'unpaid';
    }

    await invoice.save();

    const updated = await Invoice.findById(invoice._id)
      .populate('party')
      .populate('site')
      .populate('quotation');

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};
