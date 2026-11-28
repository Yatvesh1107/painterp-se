const LabourPayout = require('../models/labourPayout.model');
const LabourAttendance = require('../models/labourAttendance.model');
const Labour = require('../models/labour.model');
const Site = require('../models/site.model');
const SiteExpense = require('../models/siteExpense.model');
const { generateNextNumber } = require('../utils/generateNumber');

const getWeeklySettlementSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate (YYYY-MM-DD) are required' });
    }

    // Fetch all attendance records within range
    const attendanceRecords = await LabourAttendance.find({
      dateString: { $gte: startDate, $lte: endDate },
    })
      .populate('labour')
      .populate('shifts.site', 'name siteNumber');

    // Group records by labour
    const labourGroupMap = {};

    attendanceRecords.forEach((rec) => {
      const labour = rec.labour;
      if (!labour) return;

      const labourId = labour._id.toString();
      if (!labourGroupMap[labourId]) {
        labourGroupMap[labourId] = {
          labourId: labour._id,
          labourName: labour.name,
          labourPhone: labour.phone,
          dailyWage: labour.dailyWage,
          skill: labour.skill,
          totalDays: 0,
          grossWages: 0,
          totalAdvances: 0,
          netPayable: 0,
          allPaid: true,
          hasUnpaidRecords: false,
          attendanceIds: [],
          siteMap: {},
          daysBreakdown: [],
        };
      }

      const group = labourGroupMap[labourId];
      group.totalDays += rec.totalUnits || 0;
      group.grossWages += rec.totalWageAmount || 0;
      group.totalAdvances += rec.advanceAmount || 0;
      group.attendanceIds.push(rec._id);

      if (!rec.isPaid) {
        group.allPaid = false;
        group.hasUnpaidRecords = true;
      }

      // Record daily detail
      group.daysBreakdown.push({
        attendanceId: rec._id,
        dateString: rec.dateString,
        status: rec.status,
        units: rec.totalUnits,
        wageAmount: rec.totalWageAmount,
        advanceAmount: rec.advanceAmount || 0,
        isPaid: rec.isPaid,
        shifts: rec.shifts.map((s) => ({
          siteId: s.site?._id || s.site,
          siteName: s.site?.name || 'Site',
          siteNumber: s.site?.siteNumber || '',
          units: s.units,
          wageAmount: s.wageAmount,
        })),
      });

      // Split by site
      rec.shifts.forEach((s) => {
        const site = s.site;
        if (!site) return;
        const sId = (site._id || site).toString();
        if (!group.siteMap[sId]) {
          group.siteMap[sId] = {
            siteId: site._id || site,
            siteName: site.name || 'Site',
            siteNumber: site.siteNumber || '',
            days: 0,
            amount: 0,
          };
        }
        group.siteMap[sId].days += s.units || 0;
        group.siteMap[sId].amount += s.wageAmount || 0;
      });
    });

    // Format summary list
    const summaryList = Object.values(labourGroupMap).map((item) => {
      item.totalDays = Math.round(item.totalDays * 10) / 10;
      item.grossWages = Math.round(item.grossWages * 100) / 100;
      item.totalAdvances = Math.round(item.totalAdvances * 100) / 100;
      item.netPayable = Math.max(0, Math.round((item.grossWages - item.totalAdvances) * 100) / 100);
      item.siteBreakdown = Object.values(item.siteMap).map((sb) => ({
        siteId: sb.siteId,
        siteName: sb.siteName,
        siteNumber: sb.siteNumber,
        days: Math.round(sb.days * 10) / 10,
        amount: Math.round(sb.amount * 100) / 100,
      }));
      delete item.siteMap;
      return item;
    });

    // Also fetch completed payouts in this date range
    const existingPayouts = await LabourPayout.find({
      startDate: { $gte: new Date(startDate) },
      endDate: { $lte: new Date(`${endDate}T23:59:59.999Z`) },
    })
      .populate('labour', 'name phone')
      .populate('siteBreakdown.site', 'name siteNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      startDate,
      endDate,
      totalLaboursWithAttendance: summaryList.length,
      summary: summaryList,
      existingPayouts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const processWeeklyPayout = async (req, res) => {
  try {
    const {
      labourId,
      startDate,
      endDate,
      payoutDate,
      paymentMode,
      referenceNumber,
      notes,
    } = req.body;

    if (!labourId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Labour, startDate, and endDate are required' });
    }

    const labour = await Labour.findById(labourId);
    if (!labour) {
      return res.status(404).json({ message: 'Labour not found' });
    }

    // Find unpaid attendance records for this labour in the range
    const unpaidRecords = await LabourAttendance.find({
      labour: labourId,
      dateString: { $gte: startDate, $lte: endDate },
      isPaid: false,
    }).populate('shifts.site');

    if (unpaidRecords.length === 0) {
      return res.status(400).json({
        message: 'No unpaid attendance records found for this labour in the selected week',
      });
    }

    let totalDays = 0;
    let grossWages = 0;
    let totalAdvances = 0;
    const siteMap = {};

    unpaidRecords.forEach((rec) => {
      totalDays += rec.totalUnits || 0;
      grossWages += rec.totalWageAmount || 0;
      totalAdvances += rec.advanceAmount || 0;

      rec.shifts.forEach((s) => {
        const site = s.site;
        if (!site) return;
        const sId = (site._id || site).toString();
        if (!siteMap[sId]) {
          siteMap[sId] = {
            site: site._id || site,
            siteName: site.name || 'Site',
            siteNumber: site.siteNumber || '',
            days: 0,
            amount: 0,
          };
        }
        siteMap[sId].days += s.units || 0;
        siteMap[sId].amount += s.wageAmount || 0;
      });
    });

    totalDays = Math.round(totalDays * 10) / 10;
    grossWages = Math.round(grossWages * 100) / 100;
    totalAdvances = Math.round(totalAdvances * 100) / 100;
    const netPaidAmount = Math.max(0, Math.round((grossWages - totalAdvances) * 100) / 100);

    const payoutNumber = await generateNextNumber(LabourPayout, 'PAY', 'payoutNumber');
    const paymentDt = payoutDate ? new Date(payoutDate) : new Date();

    // 1. Automatically create SiteExpense entries for each site
    const siteBreakdown = [];
    for (const sId of Object.keys(siteMap)) {
      const item = siteMap[sId];
      if (item.amount <= 0) continue;

      const expense = await SiteExpense.create({
        site: item.site,
        expenseType: 'labour',
        title: `Labour Wages: ${labour.name} (${item.days} days, wk ending ${endDate})`,
        amount: Math.round(item.amount * 100) / 100,
        date: paymentDt,
        paymentMode: paymentMode || 'cash',
        vendorOrPerson: labour.name,
        billNumber: payoutNumber,
        notes: `Weekly Saturday payout ${payoutNumber}. Advances deducted: ₹${totalAdvances}`,
      });

      siteBreakdown.push({
        site: item.site,
        days: item.days,
        amount: item.amount,
        siteExpenseId: expense._id,
      });
    }

    // 2. Create the LabourPayout record
    const payout = await LabourPayout.create({
      payoutNumber,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      payoutDate: paymentDt,
      labour: labour._id,
      totalDays,
      dailyWage: labour.dailyWage,
      grossWages,
      totalAdvances,
      netPaidAmount,
      paymentMode: paymentMode || 'cash',
      referenceNumber: referenceNumber || '',
      notes: notes || '',
      siteBreakdown,
      attendanceRecords: unpaidRecords.map((r) => r._id),
      paidBy: req.account?._id,
    });

    // 3. Mark all attendance records as isPaid: true
    await LabourAttendance.updateMany(
      { _id: { $in: unpaidRecords.map((r) => r._id) } },
      { isPaid: true, payoutRef: payout._id }
    );

    const populatedPayout = await LabourPayout.findById(payout._id)
      .populate('labour')
      .populate('siteBreakdown.site', 'name siteNumber');

    res.status(201).json({
      message: `Successfully processed weekly payout ${payoutNumber} for ${labour.name}`,
      payout: populatedPayout,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await LabourPayout.findById(id);

    if (!payout) {
      return res.status(404).json({ message: 'Payout record not found' });
    }

    // 1. Delete associated SiteExpense records
    const expenseIds = (payout.siteBreakdown || [])
      .map((sb) => sb.siteExpenseId)
      .filter(Boolean);

    if (expenseIds.length > 0) {
      await SiteExpense.deleteMany({ _id: { $in: expenseIds } });
    }

    // 2. Unmark attendance records so they can be re-settled
    if (payout.attendanceRecords && payout.attendanceRecords.length > 0) {
      await LabourAttendance.updateMany(
        { _id: { $in: payout.attendanceRecords } },
        { isPaid: false, payoutRef: null }
      );
    }

    // 3. Delete payout record
    await LabourPayout.findByIdAndDelete(id);

    res.status(200).json({
      message: `Payout ${payout.payoutNumber} cancelled and site expenses reversed successfully.`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPayoutHistory = async (req, res) => {
  try {
    const { labourId, page, limit } = req.query;
    let query = {};
    if (labourId) query.labour = labourId;

    const payouts = await LabourPayout.find(query)
      .populate('labour', 'name phone skill')
      .populate('siteBreakdown.site', 'name siteNumber')
      .populate('paidBy', 'name')
      .sort({ payoutDate: -1, createdAt: -1 });

    res.status(200).json(payouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWeeklySettlementSummary,
  processWeeklyPayout,
  deletePayout,
  getPayoutHistory,
};
