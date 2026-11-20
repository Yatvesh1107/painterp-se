const Site = require('../models/site.model');
const { generateNextNumber } = require('../utils/generateNumber');

const getSites = async (req, res) => {
  try {
    const { status, partyId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (partyId) query.party = partyId;

    const sites = await Site.find(query)
      .populate('party', 'name phone email address')
      .populate('quotation', 'quotationNumber title totalAmount status')
      .sort({ createdAt: -1 });

    res.status(200).json(sites);
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
