const Labour = require('../models/labour.model');
const LabourAttendance = require('../models/labourAttendance.model');
const Site = require('../models/site.model');

// Helper to normalize date string YYYY-MM-DD
const normalizeDate = (dateStr) => {
  if (!dateStr) {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
  return dateStr.trim().split('T')[0];
};

const getDailyAttendance = async (req, res) => {
  try {
    const dateString = normalizeDate(req.query.date);
    const targetDate = new Date(`${dateString}T00:00:00.000Z`);

    // Fetch all active labours
    const allLabours = await Labour.find({ isActive: true }).sort({ name: 1 });

    // Fetch existing attendance records for this date
    const existingRecords = await LabourAttendance.find({ dateString })
      .populate('labour')
      .populate('shifts.site', 'name siteNumber address');

    const recordMap = {};
    existingRecords.forEach((rec) => {
      if (rec.labour?._id) {
        recordMap[rec.labour._id.toString()] = rec;
      }
    });

    // Merge: ensure every labour has a roster entry
    const roster = allLabours.map((labour) => {
      const rec = recordMap[labour._id.toString()];
      if (rec) {
        return {
          labourId: labour._id,
          labourName: labour.name,
          labourPhone: labour.phone,
          dailyWage: labour.dailyWage,
          skill: labour.skill,
          attendanceId: rec._id,
          status: rec.status, // 'scheduled', 'present', 'half_day', 'absent'
          shifts: rec.shifts.map((s) => ({
            siteId: s.site?._id || s.site,
            siteName: s.site?.name || 'Selected Site',
            siteNumber: s.site?.siteNumber || '',
            shiftType: s.shiftType,
            halfSlot: s.halfSlot || (s.shiftType === 'half_day' ? 'first_half' : 'full_day'),
            units: s.units,
            wageAmount: s.wageAmount,
            notes: s.notes || '',
          })),
          totalUnits: rec.totalUnits,
          totalWageAmount: rec.totalWageAmount,
          advanceAmount: rec.advanceAmount || 0,
          advancePaymentMode: rec.advancePaymentMode || 'cash',
          advanceNotes: rec.advanceNotes || '',
          isPaid: rec.isPaid,
          hasRecord: true,
        };
      }

      // Default unscheduled labour
      return {
        labourId: labour._id,
        labourName: labour.name,
        labourPhone: labour.phone,
        dailyWage: labour.dailyWage,
        skill: labour.skill,
        attendanceId: null,
        status: 'scheduled',
        shifts: [],
        totalUnits: 0,
        totalWageAmount: 0,
        advanceAmount: 0,
        advancePaymentMode: 'cash',
        advanceNotes: '',
        isPaid: false,
        hasRecord: false,
      };
    });

    res.status(200).json({
      dateString,
      date: targetDate,
      totalLabours: allLabours.length,
      scheduledCount: existingRecords.length,
      roster,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveDailyAttendance = async (req, res) => {
  try {
    const { dateString, records } = req.body;

    if (!dateString) {
      return res.status(400).json({ message: 'Date string (YYYY-MM-DD) is required' });
    }

    if (!Array.isArray(records)) {
      return res.status(400).json({ message: 'Records array is required' });
    }

    const targetDate = new Date(`${dateString}T00:00:00.000Z`);
    const savedResults = [];
    let skippedPaidCount = 0;

    // Pre-fetch all active labours to ensure correct wage calculation
    const labourIds = records.map((r) => r.labourId);
    const labours = await Labour.find({ _id: { $in: labourIds } });
    const labourMap = {};
    labours.forEach((l) => {
      labourMap[l._id.toString()] = l;
    });

    for (const item of records) {
      const labour = labourMap[item.labourId];
      if (!labour) continue;

      const dailyWage = labour.dailyWage || 0;
      let totalUnits = 0;
      let shifts = [];

      if (item.status === 'absent') {
        totalUnits = 0;
        shifts = [];
      } else {
        // Calculate units and shifts
        const rawShifts = Array.isArray(item.shifts) ? item.shifts : [];
        for (const s of rawShifts) {
          if (!s.siteId) continue;
          const shiftType = s.shiftType === 'half_day' ? 'half_day' : 'full_day';
          const halfSlot = s.halfSlot || (shiftType === 'half_day' ? 'first_half' : 'full_day');
          const units = shiftType === 'half_day' ? 0.5 : 1.0;
          const wageAmount = Math.round(dailyWage * units * 100) / 100;

          shifts.push({
            site: s.siteId,
            shiftType,
            halfSlot,
            units,
            wageAmount,
            notes: s.notes?.trim() || '',
          });
          totalUnits += units;
        }

        // Cap total units per day at 1.0 standard or sum of half-days
        totalUnits = Math.min(1.0, totalUnits);
      }

      const totalWageAmount = Math.round(dailyWage * totalUnits * 100) / 100;
      const advanceAmount = Math.max(0, Number(item.advanceAmount) || 0);

      // Check if attendance already exists
      let record = await LabourAttendance.findOne({
        labour: labour._id,
        dateString,
      });

      if (record) {
        if (record.isPaid) {
          // Cannot modify attendance already settled in Saturday payout!
          skippedPaidCount++;
          savedResults.push(record);
          continue;
        }

        record.status = item.status || (totalUnits > 0 ? (totalUnits === 0.5 ? 'half_day' : 'present') : 'absent');
        record.shifts = shifts;
        record.totalUnits = totalUnits;
        record.totalWageAmount = totalWageAmount;
        record.advanceAmount = advanceAmount;
        record.advancePaymentMode = item.advancePaymentMode || 'cash';
        record.advanceNotes = item.advanceNotes?.trim() || '';
        record.confirmedBy = req.account?._id;
        await record.save();
      } else {
        record = await LabourAttendance.create({
          date: targetDate,
          dateString,
          labour: labour._id,
          status: item.status || (totalUnits > 0 ? (totalUnits === 0.5 ? 'half_day' : 'present') : 'scheduled'),
          shifts,
          totalUnits,
          totalWageAmount,
          advanceAmount,
          advancePaymentMode: item.advancePaymentMode || 'cash',
          advanceNotes: item.advanceNotes?.trim() || '',
          isPaid: false,
          assignedBy: req.account?._id,
          confirmedBy: req.account?._id,
        });
      }

      savedResults.push(record);
    }

    res.status(200).json({
      message: 'Daily attendance saved successfully',
      dateString,
      savedCount: savedResults.length - skippedPaidCount,
      skippedPaidCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const copyFromPreviousDay = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required' });
    }

    const prevRecords = await LabourAttendance.find({ dateString: fromDate });
    if (prevRecords.length === 0) {
      return res.status(404).json({ message: `No attendance records found on ${fromDate}` });
    }

    const targetDate = new Date(`${toDate}T00:00:00.000Z`);
    let copiedCount = 0;

    for (const prev of prevRecords) {
      // Don't overwrite if already marked on toDate
      const existing = await LabourAttendance.findOne({
        labour: prev.labour,
        dateString: toDate,
      });

      if (!existing) {
        await LabourAttendance.create({
          date: targetDate,
          dateString: toDate,
          labour: prev.labour,
          status: 'scheduled',
          shifts: prev.shifts.map((s) => ({
            site: s.site,
            shiftType: s.shiftType,
            halfSlot: s.halfSlot || (s.shiftType === 'half_day' ? 'first_half' : 'full_day'),
            units: s.units,
            wageAmount: s.wageAmount,
            notes: 'Copied from ' + fromDate,
          })),
          totalUnits: prev.totalUnits,
          totalWageAmount: prev.totalWageAmount,
          advanceAmount: 0,
          isPaid: false,
          assignedBy: req.account?._id,
        });
        copiedCount++;
      }
    }

    res.status(200).json({
      message: `Successfully copied ${copiedCount} labour assignments from ${fromDate} to ${toDate}`,
      copiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    const { startDate, endDate, labourId, siteId } = req.query;
    let query = {};

    if (startDate && endDate) {
      query.dateString = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.dateString = { $gte: startDate };
    }

    if (labourId) {
      query.labour = labourId;
    }

    if (siteId) {
      query['shifts.site'] = siteId;
    }

    const history = await LabourAttendance.find(query)
      .populate('labour', 'name phone dailyWage skill')
      .populate('shifts.site', 'name siteNumber')
      .populate('assignedBy', 'name role')
      .sort({ dateString: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDailyAttendance,
  saveDailyAttendance,
  copyFromPreviousDay,
  getAttendanceHistory,
};
