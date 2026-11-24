const mongoose = require('mongoose');
const Service = require('../models/service.model');
const { mongoUri } = require('../config/config');

const clientCatalog = [
  // =========================================================================
  // 1. INTERIOR ITEMS - 1) ONLY PAINT (MATERIAL + LABOUR)
  // Category: 'Interior'
  // =========================================================================
  {
    name: 'Interior: Only Paint - Oil Bound Distemper',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 14,
    description: '(Non-washable) Scraping + crack filling + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Only Paint - Tractor Emulsion',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 18,
    description: '(Non-washable) Scraping + crack filling + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Only Paint - Plastic Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 24,
    description: '(100% Washable) Scraping + crack filling + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Only Paint - Royale Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 34,
    description: '(100% Washable) Scraping + crack filling + 1 coat primer + 2 coats colour (Material + Labour)',
  },

  // =========================================================================
  // 1. INTERIOR ITEMS - 2) PUTTY + PAINT (MATERIAL + LABOUR)
  // Category: 'Interior'
  // =========================================================================
  {
    name: 'Interior: Putty + Paint - Oil Bound Distemper',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 22,
    description: '(Non-washable) Scraping + crack filling + bonding chemical + 2 coats putty + sanding/finishing + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Paint - Tractor Emulsion',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 28,
    description: '(Non-washable) Scraping + crack filling + bonding chemical + 2 coats putty + sanding/finishing + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Paint - Plastic Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 34,
    description: '(100% Washable) Scraping + crack filling + bonding chemical + 2 coats putty + sanding/finishing + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Paint - Royale Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 44,
    description: '(100% Washable) Scraping + crack filling + bonding chemical + 2 coats putty + sanding/finishing + 1 coat primer + 2 coats colour (Material + Labour)',
  },

  // =========================================================================
  // 1. INTERIOR ITEMS - 3) PUTTY + ACRYLIC LAMBI + PAINT (MATERIAL + LABOUR)
  // Category: 'Interior'
  // =========================================================================
  {
    name: 'Interior: Putty + Acrylic Lambi + Paint - Oil Bound',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 30,
    description: '(Non-washable) Scraping + crack filling + 1 coat bonding chemical + 2 coats putty + 1 coat Acrylic Lambi + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Acrylic Lambi + Paint - Tractor Emulsion',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 36,
    description: '(Non-washable) Scraping + crack filling + 1 coat bonding chemical + 2 coats putty + 1 coat Acrylic Lambi + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Acrylic Lambi + Paint - Plastic Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 42,
    description: '(100% Washable) Scraping + crack filling + 1 coat bonding chemical + 2 coats putty + 1 coat Acrylic Lambi + 1 coat primer + 2 coats colour (Material + Labour)',
  },
  {
    name: 'Interior: Putty + Acrylic Lambi + Paint - Royale Paint',
    category: 'Interior',
    unit: 'sq.ft',
    defaultRate: 52,
    description: '(100% Washable) Scraping + crack filling + 1 coat bonding chemical + 2 coats putty + 1 coat Acrylic Lambi + 1 coat primer + 2 coats colour (Material + Labour)',
  },

  // =========================================================================
  // 2. EXTERIOR ITEMS - 1) ONLY PAINT (MATERIAL + LABOUR)
  // Category: 'Exterior'
  // =========================================================================
  {
    name: 'Exterior: Only Paint - Promise / Ace Emulsion (4 Years)',
    category: 'Exterior',
    unit: 'sq.ft',
    defaultRate: 20,
    description: '(4 Years) Scraping + High-pressure wash + Crack filling + 1 coat Primer + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Only Paint - WeatherShield Protect / Apex (6 Years)',
    category: 'Exterior',
    unit: 'sq.ft',
    defaultRate: 26,
    description: '(6 Years) Scraping + High-pressure wash + Crack filling + 1 coat Primer + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Only Paint - WeatherShield Max / Apex Ultima (9 Years)',
    category: 'Exterior',
    unit: 'sq.ft',
    defaultRate: 34,
    description: '(9 Years) Scraping + High-pressure wash + Crack filling + 1 coat Primer + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Only Paint - WeatherShield Powerflexx / Apex Ultima Protek (12 Years)',
    category: 'Exterior',
    unit: 'sq.ft',
    defaultRate: 45,
    description: '(12 Years) Scraping + High-pressure wash + Crack filling + 1 coat Primer + 2 coats Colour (Material + Labour)',
  },

  // =========================================================================
  // 2. EXTERIOR ITEMS - 2) WATERPROOFING (MATERIAL + LABOUR)
  // Category: 'Waterproofing' (Exterior Waterproofing)
  // =========================================================================
  {
    name: 'Exterior: Waterproofing - Promise / Ace (8 Years)',
    category: 'Waterproofing',
    unit: 'sq.ft',
    defaultRate: 38,
    description: '(8 Years) Scraping + High-pressure wash + Crack filling + 2 coats Damp Proof + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Waterproofing - WeatherShield Protect / Apex (10 Years)',
    category: 'Waterproofing',
    unit: 'sq.ft',
    defaultRate: 44,
    description: '(10 Years) Scraping + High-pressure wash + Crack filling + 2 coats Damp Proof + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Waterproofing - WeatherShield Max / Apex Ultima (10 Years)',
    category: 'Waterproofing',
    unit: 'sq.ft',
    defaultRate: 50,
    description: '(10 Years) Scraping + High-pressure wash + Crack filling + 2 coats Damp Proof + 2 coats Colour (Material + Labour)',
  },
  {
    name: 'Exterior: Waterproofing - WeatherShield Powerflexx / Apex Ultima Protek (12 Years)',
    category: 'Waterproofing',
    unit: 'sq.ft',
    defaultRate: 62,
    description: '(12 Years) Scraping + High-pressure wash + Crack filling + 2 coats Damp Proof + 2 coats Colour (Material + Labour)',
  },
];

async function seedClientCatalog() {
  console.log(`Connecting to database at ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  try {
    // Clean up temporary previous seed items with hyphenated categories
    await Service.deleteMany({
      category: {
        $in: [
          'Interior - Only Paint',
          'Interior - Putty + Paint',
          'Interior - Putty + Lambi + Paint',
          'Exterior - Only Paint',
          'Exterior - Waterproofing',
        ],
      },
    });

    // Clean up dummy testing items created during manual testing
    await Service.deleteMany({
      name: {
        $in: [
          'ere',
          'online app',
          'Weather shield protect :- 1 coat Primer + 2 Coats Color',
          'Waterproofing :- wash + Crack Fill + 2 Coat water Proofing',
          'Apex :- Crack Fill +1 coat Primer + 2 coat Color (Both)',
          'Scrap Rocked design and wash + Crack Fill + 1 coat Primer + 2 Coat Scrap  + Pyroskin',
        ],
      },
    });

    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of clientCatalog) {
      const existing = await Service.findOne({ name: item.name });
      if (existing) {
        existing.category = item.category;
        existing.unit = item.unit;
        existing.defaultRate = item.defaultRate;
        existing.description = item.description;
        existing.isActive = true;
        await existing.save();
        updatedCount++;
      } else {
        await Service.create(item);
        insertedCount++;
      }
    }

    console.log(`\n Catalog Cleaned & Seeded Successfully!`);
    console.log(`- Inserted new services: ${insertedCount}`);
    console.log(`- Updated existing services: ${updatedCount}`);

    const allServices = await Service.find({ isActive: true }).sort({ category: 1, name: 1 });
    console.log(`\nActive Services in Database now (${allServices.length}):`);
    allServices.forEach((s, idx) => {
      console.log(`${idx + 1}. [${s.category}] ${s.name} - ₹${s.defaultRate}/${s.unit}`);
    });
  } catch (error) {
    console.error('Error seeding client catalog:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase disconnected.');
  }
}

seedClientCatalog()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
