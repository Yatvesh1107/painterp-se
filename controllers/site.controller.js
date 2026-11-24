const Site = require('../models/site.model');
const SiteExpense = require('../models/siteExpense.model');
const Invoice = require('../models/invoice.model');
const { generateNextNumber } = require('../utils/generateNumber');

const Party = require('../models/party.model');

const getSites = async (req, res) => {
  try {
    const { status, partyId, search, page, limit } = req.query;
    let query = {};

    if (status && status !== 'all') query.status = status;
    if (partyId) query.party = partyId;

    if (search && search.trim()) {
      const s = search.trim();
      const matchingParties = await Party.find({ name: { $regex: s, $options: 'i' } }).select('_id');
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { siteNumber: { $regex: s, $options: 'i' } },
        { address: { $regex: s, $options: 'i' } },
        { party: { $in: matchingParties.map((p) => p._id) } },
      ];
    }

    const attachFinancials = async (siteDocs) => {
      const siteIds = siteDocs.map((s) => s._id);

      // Aggregate expenses per site strictly
      const expenseAgg = await SiteExpense.aggregate([
        { $match: { site: { $in: siteIds } } },
        {
          $group: {
            _id: '$site',
            totalExpenses: { $sum: '$amount' },
            materialCost: {
              $sum: { $cond: [{ $eq: ['$expenseType', 'material'] }, '$amount', 0] },
            },
            labourCost: {
              $sum: { $cond: [{ $eq: ['$expenseType', 'labour'] }, '$amount', 0] },
            },
            expenseCount: { $sum: 1 },
          },
        },
      ]);

      const expenseMap = {};
      expenseAgg.forEach((item) => {
        expenseMap[item._id.toString()] = item;
      });

      // Aggregate invoiced revenue per site strictly (excluding cancelled)
      const invoiceAgg = await Invoice.aggregate([
        { $match: { site: { $in: siteIds }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$site',
            totalInvoiced: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$paidAmount' },
            invoiceCount: { $sum: 1 },
          },
        },
      ]);

      const invoiceMap = {};
      invoiceAgg.forEach((item) => {
        invoiceMap[item._id.toString()] = item;
      });

      return siteDocs.map((site) => {
        const plain = site.toObject();
        const exp = expenseMap[site._id.toString()] || {
          totalExpenses: 0,
          materialCost: 0,
          labourCost: 0,
          expenseCount: 0,
        };
        const inv = invoiceMap[site._id.toString()] || {
          totalInvoiced: 0,
          totalPaid: 0,
          invoiceCount: 0,
        };

        plain.totalExpenses = exp.totalExpenses;
        plain.materialCost = exp.materialCost;
        plain.labourCost = exp.labourCost;
        plain.expenseCount = exp.expenseCount;

        plain.totalInvoiced = inv.totalInvoiced;
        plain.totalPaid = inv.totalPaid;
        plain.invoiceCount = inv.invoiceCount;

        // Revenue basis is actual invoiced amount if billed, otherwise quotation/estimate
        const revenue =
          inv.totalInvoiced > 0
            ? inv.totalInvoiced
            : plain.quotation?.totalAmount || plain.estimatedCost || 0;

        plain.revenue = revenue;
        plain.netProfit = revenue - exp.totalExpenses;
        plain.profitMargin =
          revenue > 0 ? Math.round(((revenue - exp.totalExpenses) / revenue) * 1000) / 10 : 0;

        return plain;
      });
    };

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const total = await Site.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum) || 1;

      const sites = await Site.find(query)
        .populate('party', 'name phone email address')
        .populate('quotation', 'quotationNumber title totalAmount status')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const enrichedSites = await attachFinancials(sites);

      return res.status(200).json({
        data: enrichedSites,
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

    const sites = await Site.find(query)
      .populate('party', 'name phone email address')
      .populate('quotation', 'quotationNumber title totalAmount status')
      .sort({ createdAt: -1 });

    const enrichedSites = await attachFinancials(sites);
    res.status(200).json(enrichedSites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSiteById = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('party')
      .populate('quotation');

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    res.status(200).json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSite = async (req, res) => {
  try {
    const { name, party, quotation, address, status, startDate, endDate, estimatedCost, notes } =
      req.body;

    if (!name || !party) {
      return res.status(400).json({ message: 'Name and Party are required' });
    }

    const siteNumber = await generateNextNumber(Site, 'SITE', 'siteNumber');

    const site = await Site.create({
      siteNumber,
      name,
      party,
      quotation,
      address,
      status: status || 'in_progress',
      startDate: startDate || new Date(),
      endDate,
      estimatedCost: Number(estimatedCost) || 0,
      notes,
      createdBy: req.account?._id,
    });

    const populated = await Site.findById(site._id).populate('party').populate('quotation');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSite = async (req, res) => {
  try {
    const site = await Site.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('party')
      .populate('quotation');

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    res.status(200).json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSite = async (req, res) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }
    res.status(200).json({ message: 'Site deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
};
