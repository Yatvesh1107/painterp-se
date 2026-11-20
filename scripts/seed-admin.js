const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Account = require('../models/account.model');
const { mongoUri, seedAdmin } = require('../config/config');
const { ROLES } = require('../config/roles');

const seedAdminAccount = async () => {
  if (!seedAdmin.email || !seedAdmin.password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env before seeding');
  }

  await mongoose.connect(mongoUri);

  try {
    const passwordHash = await bcrypt.hash(seedAdmin.password, 12);

    // Re-running the script keeps the seeded admin in sync with .env.
    const existing = await Account.findOne({ email: seedAdmin.email });

    if (existing) {
      existing.name = seedAdmin.name;
      existing.password = passwordHash;
      existing.role = ROLES.ADMIN;
      existing.isActive = true;
      await existing.save();
      console.log(`Admin updated: ${existing.email}`);
    } else {
      const admin = await Account.create({
        name: seedAdmin.name,
        email: seedAdmin.email,
        password: passwordHash,
        role: ROLES.ADMIN,
      });
      console.log(`Admin created: ${admin.email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

seedAdminAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`Admin seed failed: ${error.message}`);
    process.exit(1);
  });
