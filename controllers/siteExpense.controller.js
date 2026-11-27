const SiteExpense = require('../models/siteExpense.model');
const Site = require('../models/site.model');
const Invoice = require('../models/invoice.model');

// Add a new expense to a site
const addSiteExpense = async (req, res) => {
  try {
    const { siteId } = req.params;
    const {
      expenseType,
      title,
      vendorOrPerson,
      amount,
      date,
      paymentMode,
      billNumber,
      notes,
    } = req.body;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (!title || !amount) {
      return res.status(400).json({ message: 'Title and amount are required' });
    }

    const expense = await SiteExpense.create({
      site: siteId,
      expenseType: expenseType || 'material',
      title,
      vendorOrPerson,
      amount: Number(amount),
      date: date || new Date(),
      paymentMode: paymentMode || 'cash',
      billNumber,
      notes,
      createdBy: req.account?._id,
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all expenses for a site (with optional filtering)
const getSiteExpenses = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { expenseType, startDate, endDate } = req.query;

    let query = { site: siteId };
    if (expenseType && expenseType !== 'all') {
      query.expenseType = expenseType;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const expenses = await SiteExpense.find(query).sort({ date: -1, createdAt: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a site expense
const deleteSiteExpense = async (req, res) => {
  try {
    const { siteId, expenseId } = req.params;
    const expense = await SiteExpense.findOneAndDelete({ _id: expenseId, site: siteId });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get complete Profit & Loss summary for a site
const getSiteProfitLoss = async (req, res) => {
  try {
    const { siteId } = req.params;

    const site = await Site.findById(siteId)
      .populate('party', 'name phone email address')
      .populate('quotation', 'quotationNumber title totalAmount status items');

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // Strictly isolate invoices to this site only, excluding cancelled invoices
    const invoices = await Invoice.find({ site: siteId, status: { $ne: 'cancelled' } })
      .sort({ invoiceDate: -1 })
      .select('invoiceNumber invoiceDate totalAmount paidAmount balanceAmount paymentStatus payments');

    // Aggregate Invoiced Revenue & Payments
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalBalanceDue = 0;

    invoices.forEach((inv) => {
      totalInvoiced += Number(inv.totalAmount) || 0;
      totalCollected += Number(inv.paidAmount) || 0;
      totalBalanceDue += Number(inv.balanceAmount) || 0;
    });

    // If no invoices yet, fall back to approved quotation amount for project estimate
    const estimatedProjectRevenue = Number(site.quotation?.totalAmount) || totalInvoiced;

    // Fetch all site expenses
    const expenses = await SiteExpense.find({ site: siteId }).sort({ date: -1 });

    // Fetch all quotations linked to this site
    const Quotation = require('../models/quotation.model');
    const quotations = await Quotation.find({ site: siteId })
      .select('quotationNumber title totalAmount status date items')
      .sort({ createdAt: -1 });

    let totalMaterialCost = 0;
    let totalLabourCost = 0;
    let totalTransportCost = 0;
    let totalOtherCost = 0;
    let totalExpenses = 0;

    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;

      if (exp.expenseType === 'material') {
        totalMaterialCost += amt;
      } else if (exp.expenseType === 'labour') {
        totalLabourCost += amt;
      } else if (exp.expenseType === 'transport_scaffolding') {
        totalTransportCost += amt;
      } else {
        totalOtherCost += amt;
      }
    });

    // Factor in subcontractor payments as labour cost for the site
    const directLabourCost = totalLabourCost;
    const subcontractorPaid = site.subcontractor?.isAssigned ? (Number(site.subcontractor?.totalPaid) || 0) : 0;
    const subcontractorAgreed = site.subcontractor?.isAssigned ? (Number(site.subcontractor?.agreedAmount) || 0) : 0;
    const subcontractorBalance = site.subcontractor?.isAssigned ? (Number(site.subcontractor?.balanceAmount) || 0) : 0;

    // Subcontractor payments are project labour outflows, so add to total labour & total expenses
    totalLabourCost += subcontractorPaid;
    totalExpenses += subcontractorPaid;

    // Revenue base to evaluate profit: if invoiced exists, use totalInvoiced, else use estimatedProjectRevenue
    const revenueBasis = totalInvoiced > 0 ? totalInvoiced : estimatedProjectRevenue;
    const netProfit = Math.round((revenueBasis - totalExpenses) * 100) / 100;
    const profitMargin = revenueBasis > 0 ? Math.round((netProfit / revenueBasis) * 1000) / 10 : 0;

    // Cashflow profit based on actual money received in hand vs spent
    const cashflowProfit = Math.round((totalCollected - totalExpenses) * 100) / 100;

    res.status(200).json({
      site,
      revenue: {
        totalInvoiced,
        totalCollected,
        totalBalanceDue,
        estimatedProjectRevenue,
        invoicesCount: invoices.length,
        invoices,
        quotationsCount: quotations.length,
        quotations,
      },
      expenses: {
        totalExpenses,
        totalMaterialCost,
        totalLabourCost,
        directLabourCost,
        subcontractorPaid,
        subcontractorAgreed,
        subcontractorBalance,
        totalTransportCost,
        totalOtherCost,
        expensesCount: expenses.length,
        expenses,
        subcontractorPayments: site.subcontractor?.isAssigned ? (site.subcontractor.payments || []) : [],
      },
      pnl: {
        revenueBasis,
        totalExpenses,
        netProfit,
        profitMargin, // Percentage (e.g. 28.5%)
        isProfitable: netProfit >= 0,
        cashflowProfit,
        cashflowMargin: totalCollected > 0 ? Math.round((cashflowProfit / totalCollected) * 1000) / 10 : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addSiteExpense,
  getSiteExpenses,
  deleteSiteExpense,
  getSiteProfitLoss,
};
