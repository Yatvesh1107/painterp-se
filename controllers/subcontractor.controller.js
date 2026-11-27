const Subcontractor = require('../models/subcontractor.model');
const Site = require('../models/site.model');

// One-time self-healing sync from existing sites if collection is empty
const syncFromExistingSitesIfEmpty = async () => {
  try {
    const count = await Subcontractor.countDocuments();
    if (count === 0) {
      const sitesWithSub = await Site.find({
        'subcontractor.isAssigned': true,
        'subcontractor.name': { $exists: true, $ne: '' },
      });

      const seen = new Set();
      for (const site of sitesWithSub) {
        const subName = site.subcontractor.name?.trim();
        if (subName && !seen.has(subName.toLowerCase())) {
          seen.add(subName.toLowerCase());
          await Subcontractor.create({
            name: subName,
            phone: site.subcontractor.phone || '',
            specialty: site.subcontractor.workDescription || 'General Painting & Labour',
            notes: 'Auto-imported from site ' + (site.siteNumber || site.name),
          });
        }
      }
    }
  } catch (err) {
    console.error('Subcontractor initial sync error:', err.message);
  }
};

const getSubcontractors = async (req, res) => {
  try {
    await syncFromExistingSitesIfEmpty();

    const { search, activeOnly } = req.query;
    let query = {};

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { address: { $regex: s, $options: 'i' } },
        { specialty: { $regex: s, $options: 'i' } },
      ];
    }

    const subcontractors = await Subcontractor.find(query).sort({ name: 1 });

    // Attach active site count for each subcontractor
    const subNames = subcontractors.map((s) => s.name);
    const sites = await Site.find({
      'subcontractor.isAssigned': true,
      'subcontractor.name': { $in: subNames },
    }).select('name siteNumber subcontractor');

    const countsMap = {};
    sites.forEach((site) => {
      const name = site.subcontractor?.name;
      if (name) {
        countsMap[name] = (countsMap[name] || 0) + 1;
      }
    });

    const enriched = subcontractors.map((sub) => {
      const plain = sub.toObject();
      plain.assignedSitesCount = countsMap[sub.name] || 0;
      return plain;
    });

    res.status(200).json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSubcontractor = async (req, res) => {
  try {
    const { name, phone, address, specialty, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Subcontractor name is required' });
    }

    const trimmedName = name.trim();

    // Check if duplicate name exists
    const existing = await Subcontractor.findOne({
      name: { $regex: `^${trimmedName}$`, $options: 'i' },
    });

    if (existing) {
      return res.status(400).json({
        message: `Subcontractor "${trimmedName}" already exists`,
        subcontractor: existing,
      });
    }

    const subcontractor = await Subcontractor.create({
      name: trimmedName,
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      specialty: specialty?.trim() || 'General Painting & Labour',
      notes: notes?.trim() || '',
      isActive: true,
    });

    res.status(201).json(subcontractor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, specialty, notes, isActive } = req.body;

    const subcontractor = await Subcontractor.findById(id);
    if (!subcontractor) {
      return res.status(404).json({ message: 'Subcontractor not found' });
    }

    if (name !== undefined) subcontractor.name = name.trim();
    if (phone !== undefined) subcontractor.phone = phone.trim();
    if (address !== undefined) subcontractor.address = address.trim();
    if (specialty !== undefined) subcontractor.specialty = specialty.trim();
    if (notes !== undefined) subcontractor.notes = notes.trim();
    if (isActive !== undefined) subcontractor.isActive = Boolean(isActive);

    await subcontractor.save();

    res.status(200).json(subcontractor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;
    const subcontractor = await Subcontractor.findById(id);

    if (!subcontractor) {
      return res.status(404).json({ message: 'Subcontractor not found' });
    }

    // Check if assigned to any sites
    const activeSitesCount = await Site.countDocuments({
      'subcontractor.isAssigned': true,
      'subcontractor.name': subcontractor.name,
    });

    if (activeSitesCount > 0) {
      return res.status(400).json({
        message: `Cannot delete subcontractor "${subcontractor.name}" because they are assigned to ${activeSitesCount} active site contract(s). Deactivate instead.`,
      });
    }

    await Subcontractor.findByIdAndDelete(id);
    res.status(200).json({ message: 'Subcontractor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
};
