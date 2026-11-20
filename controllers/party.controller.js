const Party = require('../models/party.model');

const getParties = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const parties = await Party.find(query).sort({ createdAt: -1 });
    res.status(200).json(parties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPartyById = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }
    res.status(200).json(party);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createParty = async (req, res) => {
  try {
    const { name, phone, email, address, gstNumber, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and Phone are required' });
    }

    const party = await Party.create({
      name,
      phone,
      email,
      address,
      gstNumber,
      notes,
    });

    res.status(201).json(party);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateParty = async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }
    res.status(200).json(party);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteParty = async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }
    res.status(200).json({ message: 'Party deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
};
