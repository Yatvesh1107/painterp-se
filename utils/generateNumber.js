const generateNextNumber = async (Model, prefix, fieldName = 'number') => {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `${prefix}-${currentYear}-`;

  const lastDoc = await Model.findOne({
    [fieldName]: { $regex: `^${yearPrefix}` },
  })
    .sort({ createdAt: -1 })
    .select(fieldName)
    .lean();

  let nextSequence = 1;
  if (lastDoc && lastDoc[fieldName]) {
    const parts = lastDoc[fieldName].split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${yearPrefix}${String(nextSequence).padStart(4, '0')}`;
};

module.exports = { generateNextNumber };
