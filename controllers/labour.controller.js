const Labour = require('../models/labour.model');

const getLabours = async (req, res) => {
  try {
    const { search, activeOnly, skill } = req.query;
    let query = {};

    if (activeOnly !== 'false') {
      query.isActive = true;
    }

    if (skill) {
      query.skill = skill;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { skill: { $regex: s, $options: 'i' } },
      ];
    }

    const labours = await Labour.find(query).sort({ name: 1 });
    res.status(200).json(labours);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLabourById = async (req, res) => {
  try {
    const labour = await Labour.findById(req.params.id);
    if (!labour) {
      return res.status(404).json({ message: 'Labour not found' });
    }
    res.status(200).json(labour);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createLabour = async (req, res) => {
  try {
    const { name, phone, dailyWage, skill, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Labour name is required' });
    }

    const wage = Number(dailyWage);
    if (isNaN(wage) || wage < 0) {
      return res.status(400).json({ message: 'Valid daily wage is required' });
    }

    const labour = await Labour.create({
      name: name.trim(),
      phone: phone?.trim() || '',
      dailyWage: wage,
      skill: skill?.trim() || 'Painter',
      address: address?.trim() || '',
      notes: notes?.trim() || '',
      isActive: true,
      createdBy: req.account?._id,
    });

    res.status(201).json(labour);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateLabour = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, dailyWage, skill, address, notes, isActive } = req.body;

    const labour = await Labour.findById(id);
    if (!labour) {
      return res.status(404).json({ message: 'Labour not found' });
    }

    if (name !== undefined) labour.name = name.trim();
    if (phone !== undefined) labour.phone = phone.trim();
    if (dailyWage !== undefined) labour.dailyWage = Math.max(0, Number(dailyWage) || 0);
    if (skill !== undefined) labour.skill = skill.trim();
    if (address !== undefined) labour.address = address.trim();
    if (notes !== undefined) labour.notes = notes.trim();
    if (isActive !== undefined) labour.isActive = Boolean(isActive);

    await labour.save();
    res.status(200).json(labour);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLabour = async (req, res) => {
  try {
    const { id } = req.params;
    const labour = await Labour.findById(id);
    if (!labour) {
      return res.status(404).json({ message: 'Labour not found' });
    }

    // Soft delete by deactivating
    labour.isActive = false;
    await labour.save();

    res.status(200).json({ message: 'Labour deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLabours,
  getLabourById,
  createLabour,
  updateLabour,
  deleteLabour,
};
