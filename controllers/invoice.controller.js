const Invoice = require('../models/invoice.model');
const Party = require('../models/party.model');
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
    const { partyId, siteId, paymentStatus } = req.query;
    let query = {};

    if (partyId) query.party = partyId;
    if (siteId) query.site = siteId;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
      notes,
    } = req.body;

    if (!party) {
      return res.status(400).json({ message: 'Party is required' });
    }

    const totals = calculateInvoiceTotals(items, discount, taxEnabled, taxRate);
    const invoiceNumber = await generateNextNumber(Invoice, 'INV', 'invoiceNumber');

    const invoice = await Invoice.create({
      invoiceNumber,
      party,
      site,
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

// Statement of Account / Ledger by Party
const getStatementByParty = async (req, res) => {
  try {
    const { partyId } = req.params;

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    const invoices = await Invoice.find({ party: partyId })
      .populate('site', 'name siteNumber')
      .sort({ invoiceDate: 1 });

    let totalBilled = 0;
    let totalPaid = 0;
    const paymentsList = [];

    invoices.forEach((inv) => {
      totalBilled += inv.totalAmount;
      totalPaid += inv.paidAmount;

      inv.payments.forEach((pay) => {
        paymentsList.push({
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          paymentNumber: pay.paymentNumber,
          amount: pay.amount,
          date: pay.date,
          paymentMode: pay.paymentMode,
          referenceNumber: pay.referenceNumber,
          notes: pay.notes,
        });
      });
    });

    // Sort payments chronologically
    paymentsList.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalOutstanding = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

    res.status(200).json({
      party,
      summary: {
        totalInvoices: invoices.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding,
      },
      invoices,
      payments: paymentsList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { items, discount, taxEnabled, taxRate, dueDate, notes, status } = req.body;

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
    if (notes) invoice.notes = notes;
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
  getStatementByParty,
  updateInvoice,
  deleteInvoice,
};
