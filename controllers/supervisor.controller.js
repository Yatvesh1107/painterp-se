const bcrypt = require('bcryptjs');
const Account = require('../models/account.model');
const { ROLES } = require('../config/roles');

const getSupervisors = async (req, res) => {
  try {
    const supervisors = await Account.find({ role: ROLES.SUPERVISOR }).sort({ name: 1 });
    res.status(200).json(supervisors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSupervisor = async (req, res) => {
  try {
    const { name, phone, password, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Supervisor name is required' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Supervisor phone number is required' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');

    // Check if phone or email already registered
    const existing = await Account.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: phone.trim() },
        email ? { email: email.toLowerCase().trim() } : null,
      ].filter(Boolean),
    });

    if (existing) {
      return res.status(400).json({
        message: `Account with phone "${phone.trim()}" already exists (${existing.name})`,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const supervisorEmail = email?.trim()?.toLowerCase() || `${cleanPhone}@supervisor.painterp`;

    const supervisor = await Account.create({
      name: name.trim(),
      phone: cleanPhone,
      email: supervisorEmail,
      password: hashedPassword,
      role: ROLES.SUPERVISOR,
      isActive: true,
    });

    res.status(201).json({
      message: 'Supervisor account created successfully',
      supervisor: {
        id: supervisor._id,
        name: supervisor.name,
        phone: supervisor.phone,
        email: supervisor.email,
        role: supervisor.role,
        isActive: supervisor.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSupervisor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, password, isActive } = req.body;

    const supervisor = await Account.findById(id).select('+password');
    if (!supervisor || supervisor.role !== ROLES.SUPERVISOR) {
      return res.status(404).json({ message: 'Supervisor account not found' });
    }

    if (name !== undefined) supervisor.name = name.trim();
    if (phone !== undefined) {
      supervisor.phone = phone.trim().replace(/\D/g, '');
    }
    if (password && password.trim().length >= 4) {
      supervisor.password = await bcrypt.hash(password.trim(), 10);
    }
    if (isActive !== undefined) supervisor.isActive = Boolean(isActive);

    await supervisor.save();

    res.status(200).json({
      message: 'Supervisor updated successfully',
      supervisor: {
        id: supervisor._id,
        name: supervisor.name,
        phone: supervisor.phone,
        email: supervisor.email,
        role: supervisor.role,
        isActive: supervisor.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSupervisor = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisor = await Account.findById(id);
    if (!supervisor || supervisor.role !== ROLES.SUPERVISOR) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    await Account.findByIdAndDelete(id);
    res.status(200).json({ message: 'Supervisor account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSupervisors,
  createSupervisor,
  updateSupervisor,
  deleteSupervisor,
};
