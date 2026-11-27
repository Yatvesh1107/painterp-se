const mongoose = require('mongoose');
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
      const siteObjectIds = siteDocs.map((s) =>
        s._id instanceof mongoose.Types.ObjectId ? s._id : new mongoose.Types.ObjectId(s._id)
      );
      const siteIdStrings = siteDocs.map((s) => s._id.toString());
      const allSiteIdMatches = [...new Set([...siteObjectIds, ...siteIdStrings])];

      // Aggregate expenses per site strictly
      const expenseAgg = await SiteExpense.aggregate([
        { $match: { site: { $in: allSiteIdMatches } } },
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
        { $match: { site: { $in: allSiteIdMatches }, status: { $ne: 'cancelled' } } },
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

        const subPaid = plain.subcontractor?.isAssigned ? (Number(plain.subcontractor?.totalPaid) || 0) : 0;
        const totalExpenses = (exp.totalExpenses || 0) + subPaid;
        const labourCost = (exp.labourCost || 0) + subPaid;

        plain.totalExpenses = totalExpenses;
        plain.materialCost = exp.materialCost;
        plain.labourCost = labourCost;
        plain.directLabourCost = exp.labourCost || 0;
        plain.subcontractorPaid = subPaid;
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
        plain.netProfit = revenue - totalExpenses;
        plain.profitMargin =
          revenue > 0 ? Math.round(((revenue - totalExpenses) / revenue) * 1000) / 10 : 0;

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

const assignOrUpdateSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      subcontractorRef,
      workDescription,
      agreedAmount,
      startDate,
      targetCompletionDate,
      status,
      notes,
    } = req.body;

    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (!site.subcontractor) {
      site.subcontractor = {
        isAssigned: true,
        payments: [],
        totalPaid: 0,
        balanceAmount: 0,
      };
    }

    site.subcontractor.isAssigned = true;
    if (subcontractorRef !== undefined) site.subcontractor.subcontractorRef = subcontractorRef || null;
    if (name !== undefined) site.subcontractor.name = name;
    if (phone !== undefined) site.subcontractor.phone = phone;
    if (workDescription !== undefined) site.subcontractor.workDescription = workDescription;
    if (agreedAmount !== undefined) site.subcontractor.agreedAmount = Math.max(0, Number(agreedAmount) || 0);
    if (startDate !== undefined) site.subcontractor.startDate = startDate;
    if (targetCompletionDate !== undefined) site.subcontractor.targetCompletionDate = targetCompletionDate;
    if (status !== undefined) site.subcontractor.status = status;
    if (notes !== undefined) site.subcontractor.notes = notes;

    // Recalculate totals
    const totalPaid = (site.subcontractor.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
    site.subcontractor.totalPaid = Math.round(totalPaid * 100) / 100;
    site.subcontractor.balanceAmount = Math.max(
      0,
      Math.round(((site.subcontractor.agreedAmount || 0) - site.subcontractor.totalPaid) * 100) / 100
    );

    if (site.subcontractor.balanceAmount === 0 && site.subcontractor.totalPaid > 0) {
      site.subcontractor.status = 'completed';
    }

    await site.save();

    const updated = await Site.findById(id).populate('party').populate('quotation');
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addSubcontractorPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, paymentMode, referenceNumber, notes } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (!site.subcontractor || !site.subcontractor.isAssigned) {
      return res.status(400).json({ message: 'No subcontractor assigned to this site' });
    }

    const paymentIndex = (site.subcontractor.payments || []).length + 1;
    const paymentNumber = `SCP-${String(paymentIndex).padStart(3, '0')}`;

    const newPayment = {
      paymentNumber,
      date: date || new Date(),
      amount: Math.round(Number(amount) * 100) / 100,
      paymentMode: paymentMode || 'cash',
      referenceNumber: referenceNumber || '',
      notes: notes || '',
      recordedBy: req.account?._id,
    };

    site.subcontractor.payments.push(newPayment);

    // Recalculate totals
    const totalPaid = (site.subcontractor.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
    site.subcontractor.totalPaid = Math.round(totalPaid * 100) / 100;
    site.subcontractor.balanceAmount = Math.max(
      0,
      Math.round(((site.subcontractor.agreedAmount || 0) - site.subcontractor.totalPaid) * 100) / 100
    );

    if (site.subcontractor.balanceAmount === 0 && site.subcontractor.totalPaid > 0) {
      site.subcontractor.status = 'completed';
    }

    await site.save();

    const updated = await Site.findById(id).populate('party').populate('quotation');
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSubcontractorPayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (!site.subcontractor) {
      return res.status(400).json({ message: 'No subcontractor data on this site' });
    }

    site.subcontractor.payments = (site.subcontractor.payments || []).filter(
      (p) => p._id.toString() !== paymentId.toString()
    );

    // Recalculate totals
    const totalPaid = (site.subcontractor.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
    site.subcontractor.totalPaid = Math.round(totalPaid * 100) / 100;
    site.subcontractor.balanceAmount = Math.max(
      0,
      Math.round(((site.subcontractor.agreedAmount || 0) - site.subcontractor.totalPaid) * 100) / 100
    );

    await site.save();

    const updated = await Site.findById(id).populate('party').populate('quotation');
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;

    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    site.subcontractor = {
      isAssigned: false,
      name: '',
      phone: '',
      workDescription: '',
      agreedAmount: 0,
      status: 'active',
      notes: '',
      payments: [],
      totalPaid: 0,
      balanceAmount: 0,
    };

    await site.save();

    const updated = await Site.findById(id).populate('party').populate('quotation');
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSubcontractors = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = { 'subcontractor.isAssigned': true };

    if (status && status !== 'all') {
      if (status === 'active') {
        query['subcontractor.status'] = 'active';
      } else if (status === 'completed') {
        query['subcontractor.status'] = 'completed';
      } else if (status === 'pending_due') {
        query['subcontractor.balanceAmount'] = { $gt: 0 };
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { 'subcontractor.name': { $regex: s, $options: 'i' } },
        { 'subcontractor.phone': { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { siteNumber: { $regex: s, $options: 'i' } },
      ];
    }

    const sites = await Site.find(query)
      .populate('party', 'name phone')
      .sort({ updatedAt: -1 });

    let totalAgreed = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;

    sites.forEach((site) => {
      totalAgreed += Number(site.subcontractor?.agreedAmount) || 0;
      totalPaid += Number(site.subcontractor?.totalPaid) || 0;
      totalBalanceDue += Number(site.subcontractor?.balanceAmount) || 0;
    });

    res.status(200).json({
      summary: {
        totalContracts: sites.length,
        totalAgreed: Math.round(totalAgreed * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalBalanceDue: Math.round(totalBalanceDue * 100) / 100,
      },
      contracts: sites.map((s) => ({
        siteId: s._id,
        siteNumber: s.siteNumber,
        siteName: s.name,
        party: s.party,
        subcontractor: s.subcontractor,
      })),
    });
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
  assignOrUpdateSubcontractor,
  addSubcontractorPayment,
  deleteSubcontractorPayment,
  removeSubcontractor,
  getSubcontractors,
};
