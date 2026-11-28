const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = require('../app');
const connectDB = require('../config/db');
const { ROLES } = require('../config/roles');
const Account = require('../models/account.model');
const Party = require('../models/party.model');
const Service = require('../models/service.model');
const Quotation = require('../models/quotation.model');
const Site = require('../models/site.model');
const Invoice = require('../models/invoice.model');
const Labour = require('../models/labour.model');
const LabourAttendance = require('../models/labourAttendance.model');
const LabourPayout = require('../models/labourPayout.model');
const SiteExpense = require('../models/siteExpense.model');

let server;
let baseUrl;
let adminToken;

const cleanup = {
  accounts: [],
  parties: [],
  services: [],
  quotations: [],
  sites: [],
  invoices: [],
  labours: [],
  attendances: [],
  payouts: [],
  expenses: [],
};

const apiFetch = async (urlPath, options = {}) => {
  const res = await fetch(`${baseUrl}${urlPath}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body };
};

describe('PaintErp Core ERP Business Flows', () => {
  before(async () => {
    await connectDB();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const suffix = Date.now();
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    const adminAcc = await Account.create({
      name: `__erpflow_admin_${suffix}`,
      email: `erpflow_admin_${suffix}@painterp.local`,
      phone: `777000${String(suffix).slice(-4)}`,
      password: hashedPassword,
      role: ROLES.ADMIN,
      isActive: true,
    });
    cleanup.accounts.push(adminAcc._id);

    const loginRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminAcc.email, password: 'TestPass123!' }),
    });
    adminToken = loginRes.body.token;
  });

  after(async () => {
    try {
      if (cleanup.expenses.length) await SiteExpense.deleteMany({ _id: { $in: cleanup.expenses } });
      if (cleanup.payouts.length) await LabourPayout.deleteMany({ _id: { $in: cleanup.payouts } });
      if (cleanup.attendances.length)
        await LabourAttendance.deleteMany({ _id: { $in: cleanup.attendances } });
      if (cleanup.labours.length) await Labour.deleteMany({ _id: { $in: cleanup.labours } });
      if (cleanup.invoices.length) await Invoice.deleteMany({ _id: { $in: cleanup.invoices } });
      if (cleanup.sites.length) await Site.deleteMany({ _id: { $in: cleanup.sites } });
      if (cleanup.quotations.length) await Quotation.deleteMany({ _id: { $in: cleanup.quotations } });
      if (cleanup.services.length) await Service.deleteMany({ _id: { $in: cleanup.services } });
      if (cleanup.parties.length) await Party.deleteMany({ _id: { $in: cleanup.parties } });
      if (cleanup.accounts.length) await Account.deleteMany({ _id: { $in: cleanup.accounts } });
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.connection.close();
    }
  });

  it('Parties CRUD lifecycle works end-to-end', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const createRes = await apiFetch('/api/parties', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: '__erpflow_party',
        phone: '9876500001',
        address: 'Kolhapur',
      }),
    });
    assert.equal(createRes.status, 201);
    const partyId = createRes.body._id;
    cleanup.parties.push(partyId);

    const getRes = await apiFetch(`/api/parties/${partyId}`, { headers });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.name, '__erpflow_party');

    const updRes = await apiFetch(`/api/parties/${partyId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: '__erpflow_party_updated' }),
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.name, '__erpflow_party_updated');
  });

  it('Services & Rates CRUD lifecycle works end-to-end', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const createRes = await apiFetch('/api/services', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: '__erpflow_apex_painting',
        category: 'Exterior',
        unit: 'sq ft',
        defaultRate: 28,
      }),
    });
    assert.equal(createRes.status, 201);
    const serviceId = createRes.body._id;
    cleanup.services.push(serviceId);

    const updRes = await apiFetch(`/api/services/${serviceId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ defaultRate: 32 }),
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.defaultRate, 32);
  });

  it('Site creation, Quotation totals, and Quotation approval work end-to-end', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const partyId = cleanup.parties[0];

    const siteRes = await apiFetch('/api/sites', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        party: partyId,
        name: '__erpflow_bungalow_site',
        address: 'Kolhapur',
      }),
    });
    assert.equal(siteRes.status, 201);
    const siteId = siteRes.body._id;
    cleanup.sites.push(siteId);

    const qRes = await apiFetch('/api/quotations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        party: partyId,
        site: siteId,
        title: '__erpflow_bungalow_painting',
        items: [
          {
            serviceName: 'Apex Exterior',
            areaSqFt: 1000,
            unit: 'sq ft',
            rate: 30,
          },
        ],
        discount: 2000,
        taxEnabled: true,
        taxRate: 18,
      }),
    });
    assert.equal(qRes.status, 201);
    const quotationId = qRes.body._id;
    cleanup.quotations.push(quotationId);

    // 1000 * 30 = 30000; -2000 discount = 28000; +18% GST (5040) = 33040
    assert.equal(qRes.body.subtotal, 30000);
    assert.equal(qRes.body.taxAmount, 5040);
    assert.equal(qRes.body.totalAmount, 33040);

    // Approve quotation
    const approveRes = await apiFetch(`/api/quotations/${quotationId}/approve`, {
      method: 'POST',
      headers,
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.quotation.status, 'approved');
  });

  it('Invoice creation, partial/full payments, and party statement balance tracking', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const partyId = cleanup.parties[0];
    const siteId = cleanup.sites[0];
    const quotationId = cleanup.quotations[0];

    const invRes = await apiFetch('/api/invoices', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        party: partyId,
        site: siteId,
        quotation: quotationId,
        items: [{ serviceName: 'Apex Exterior', areaSqFt: 500, unit: 'sq ft', rate: 30 }],
        taxEnabled: false,
      }),
    });
    assert.equal(invRes.status, 201);
    const invoiceId = invRes.body._id;
    cleanup.invoices.push(invoiceId);
    assert.equal(invRes.body.totalAmount, 15000);
    assert.equal(invRes.body.paymentStatus, 'unpaid');

    // Partial payment: 5000
    const pay1 = await apiFetch(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 5000, paymentMode: 'upi', notes: 'Advance' }),
    });
    assert.equal(pay1.status, 200);
    const invAfterPay1 = pay1.body.invoice || pay1.body;
    assert.equal(invAfterPay1.paidAmount, 5000);
    assert.equal(invAfterPay1.balanceAmount, 10000);
    assert.equal(invAfterPay1.paymentStatus, 'partially_paid');

    // Remaining payment: 10000
    const pay2 = await apiFetch(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 10000, paymentMode: 'bank_transfer', notes: 'Final' }),
    });
    assert.equal(pay2.status, 200);
    const invAfterPay2 = pay2.body.invoice || pay2.body;
    assert.equal(invAfterPay2.paidAmount, 15000);
    assert.equal(invAfterPay2.balanceAmount, 0);
    assert.equal(invAfterPay2.paymentStatus, 'paid');

    // Party statement reflects invoice & payments
    const stmtRes = await apiFetch(`/api/invoices/statement/party/${partyId}`, { headers });
    assert.equal(stmtRes.status, 200);
    assert.ok(stmtRes.body.summary.totalBilled >= 15000);
    assert.ok(stmtRes.body.summary.totalPaid >= 15000);
  });

  it('Site Subcontractor assignment, installment payment & Profit/Loss calculation', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const siteId = cleanup.sites[0];

    const assignRes = await apiFetch(`/api/sites/${siteId}/subcontractor`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        isAssigned: true,
        name: '__erpflow_subcontractor',
        phone: '9888877777',
        agreedAmount: 8000,
      }),
    });
    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.subcontractor.agreedAmount, 8000);

    const subPayRes = await apiFetch(`/api/sites/${siteId}/subcontractor/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 3000, paymentMode: 'cash', notes: '1st Hafta' }),
    });
    assert.equal(subPayRes.status, 201);
    assert.equal(subPayRes.body.subcontractor.totalPaid, 3000);
    assert.equal(subPayRes.body.subcontractor.balanceAmount, 5000);

    const pnlRes = await apiFetch(`/api/sites/${siteId}/profit-loss`, { headers });
    assert.equal(pnlRes.status, 200);
    assert.equal(pnlRes.body.revenue.totalInvoiced, 15000);
    assert.equal(pnlRes.body.expenses.subcontractorPaid, 3000);
    assert.equal(pnlRes.body.pnl.netProfit, 12000);
  });

  it('Weekly Labour Payout settles attendance, posts SiteExpense, and reverses cleanly on delete', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const siteId = cleanup.sites[0];

    const labour = await Labour.create({
      name: '__erpflow_labour',
      dailyWage: 1000,
      skill: 'Painter',
      isActive: true,
    });
    cleanup.labours.push(labour._id);

    const testDate = '2099-02-02';
    const saveAtt = await apiFetch('/api/attendance/save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dateString: testDate,
        records: [
          {
            labourId: labour._id.toString(),
            status: 'full_day',
            shifts: [{ siteId, shiftType: 'full_day', halfSlot: 'full_day', units: 1.0 }],
            advanceAmount: 200,
            advanceNotes: 'Tea/Lunch',
          },
        ],
      }),
    });
    assert.equal(saveAtt.status, 200);

    const attDoc = await LabourAttendance.findOne({ labour: labour._id, dateString: testDate });
    cleanup.attendances.push(attDoc._id);

    // Check weekly summary
    const sumRes = await apiFetch(
      `/api/payouts/summary?startDate=${testDate}&endDate=${testDate}`,
      { headers }
    );
    assert.equal(sumRes.status, 200);
    const workerSum = sumRes.body.summary.find((s) => s.labourId === labour._id.toString());
    assert.ok(workerSum);
    assert.equal(workerSum.grossWages, 1000);
    assert.equal(workerSum.totalAdvances, 200);
    assert.equal(workerSum.netPayable, 800);

    // Process payout
    const payRes = await apiFetch('/api/payouts/pay', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        labourId: labour._id.toString(),
        startDate: testDate,
        endDate: testDate,
        payoutDate: testDate,
        paymentMode: 'cash',
      }),
    });
    assert.equal(payRes.status, 201);
    const payoutId = payRes.body.payout._id;
    cleanup.payouts.push(payoutId);

    const paidAtt = await LabourAttendance.findById(attDoc._id);
    assert.equal(paidAtt.isPaid, true);

    const postedExpenses = await SiteExpense.find({ site: siteId, expenseType: 'labour' });
    assert.equal(postedExpenses.length, 1);
    assert.equal(postedExpenses[0].amount, 1000);

    // Reverse payout -> should unmark attendance and delete posted SiteExpense
    const delPayRes = await apiFetch(`/api/payouts/${payoutId}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(delPayRes.status, 200);

    const unpaidAtt = await LabourAttendance.findById(attDoc._id);
    assert.equal(unpaidAtt.isPaid, false);

    const remainingExpenses = await SiteExpense.find({ site: siteId, expenseType: 'labour' });
    assert.equal(remainingExpenses.length, 0);
  });
});
