const mongoose = require('mongoose');
const Service = require('../models/service.model');
const { mongoUri } = require('../config/config');

const defaultServices = [
  {
    name: 'Interior Acrylic Emulsion (2 Coats)',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 18,
    description: 'Includes surface cleaning, 1 coat primer, and 2 coats acrylic emulsion.',
  },
  {
    name: 'Premium Luxury Interior Emulsion (Royale/Velvet)',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 32,
    description: 'High-sheen washable finish, includes micro-sanding and 2 coats premium finish.',
  },
  {
    name: 'Exterior Apex Weatherproof Emulsion (2 Coats)',
    category: 'Exterior',
    unit: 'sq.ft',
    defaultRate: 24,
    description: 'Anti-algal, UV and rain resistant exterior emulsion with 5-year durability.',
  },
  {
    name: 'Wall Putty Application (2 Coats + Sanding)',
    category: 'Preparation & Putty',
    unit: 'sq.ft',
    defaultRate: 12,
    description: 'Coarse and fine wall putty leveling followed by smooth surface sanding.',
  },
  {
    name: 'Water-based Wall Primer (1 Coat)',
    category: 'Preparation & Putty',
    unit: 'sq.ft',
    defaultRate: 7,
    description: 'Base primer coat for bonding and alkali resistance.',
  },
  {
    name: 'Terrace / Wall Waterproofing Membrane',
    category: 'Waterproofing',
    unit: 'sq.ft',
    defaultRate: 45,
    description: 'Polymer elastomeric coating with fiber mesh reinforcement.',
  },
  {
    name: 'Designer Wall Texture Finish',
    category: 'Texture & Designer',
    unit: 'sq.ft',
    defaultRate: 65,
    description: 'Decorative rustic / metallic texture application on feature walls.',
  },
  {
    name: 'Synthetic Enamel Paint on Doors / Grills',
    category: 'Wood & Metal',
    unit: 'sq.ft',
    defaultRate: 28,
    description: 'Rust-cleaning, red oxide primer, and 2 coats high gloss synthetic enamel.',
  },
];

const seedServices = async () => {
  await mongoose.connect(mongoUri);
  try {
    const count = await Service.countDocuments();
    if (count === 0) {
      await Service.insertMany(defaultServices);
      console.log(`Seeded ${defaultServices.length} standard painting services!`);
    } else {
      console.log(`Services already present (${count} services). Skipping seed.`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

seedServices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed services:', err);
    process.exit(1);
  });
