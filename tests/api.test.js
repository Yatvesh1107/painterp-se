const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = require('../app');
const connectDB = require('../config/db');
const { ROLES } = require('../config/roles');
const Account = require('../models/account.model');
const Party = require('../models/party.model');
const Site = require('../models/site.model');
const Labour = require('../models/labour.model');
const LabourAttendance = require('../models/labourAttendance.model');
const SiteExpense = require('../models/siteExpense.model');
const Settings = require('../models/settings.model');

// Minimal valid 1x1 PNG binary
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

let server;
let baseUrl;
let adminToken;
let supervisorToken;

const createdIds = {
  accounts: [],
  parties: [],
  sites: [],
  labours: [],
  attendances: [],
  expenses: [],
};
const uploadedFilesToClean = [];
let originalSettingsSnapshot = null;

const apiFetch = async (urlPath, options = {}) => {
  const res = await fetch(`${baseUrl}${urlPath}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body, headers: res.headers };
};

describe('PaintErp Automated API & Integration Tests', () => {
  before(async () => {
    await connectDB();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    // Snapshot existing settings so QR test restores them cleanly
    const existingSettings = await Settings.findOne().lean();
    if (existingSettings) {
      originalSettingsSnapshot = { ...existingSettings };
    }

    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    const suffix = Date.now();

    const adminAcc = await Account.create({
      name: `__autotest_admin_${suffix}`,
      email: `autotest_admin_${suffix}@painterp.local`,
      phone: `999000${String(suffix).slice(-4)}`,
      password: hashedPassword,
      role: ROLES.ADMIN,
      isActive: true,
    });
    createdIds.accounts.push(adminAcc._id);

    const supAcc = await Account.create({
      name: `__autotest_sup_${suffix}`,
      email: `autotest_sup_${suffix}@supervisor.painterp`,
      phone: `888000${String(suffix).slice(-4)}`,
      password: hashedPassword,
      role: ROLES.SUPERVISOR,
      isActive: true,
    });
    createdIds.accounts.push(supAcc._id);
  });

  after(async () => {
    try {
      if (createdIds.expenses.length) {
        await SiteExpense.deleteMany({ _id: { $in: createdIds.expenses } });
      }
      if (createdIds.attendances.length) {
        await LabourAttendance.deleteMany({ _id: { $in: createdIds.attendances } });
      }
      if (createdIds.labours.length) {
        await Labour.deleteMany({ _id: { $in: createdIds.labours } });
      }
      if (createdIds.sites.length) {
        await Site.deleteMany({ _id: { $in: createdIds.sites } });
      }
      if (createdIds.parties.length) {
        await Party.deleteMany({ _id: { $in: createdIds.parties } });
      }
      if (createdIds.accounts.length) {
        await Account.deleteMany({ _id: { $in: createdIds.accounts } });
      }
      if (originalSettingsSnapshot) {
        await Settings.findByIdAndUpdate(originalSettingsSnapshot._id, {
          qrCodeImage: originalSettingsSnapshot.qrCodeImage || '',
        });
      }
      for (const relPath of uploadedFilesToClean) {
        const fullPath = path.join(__dirname, '..', relPath.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      await mongoose.connection.close();
    }
  });

  it('GET /api/health returns 200 ok', async () => {
    const res = await apiFetch('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('Authenticates Admin (email) and Supervisor (phone) and rejects wrong password', async () => {
    const adminAcc = await Account.findById(createdIds.accounts[0]);
    const supAcc = await Account.findById(createdIds.accounts[1]);

    // Bad password
    const badRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminAcc.email, password: 'WrongPassword' }),
    });
    assert.equal(badRes.status, 401);

    // Admin login
    const adminRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminAcc.email, password: 'TestPass123!' }),
    });
    assert.equal(adminRes.status, 200);
    assert.ok(adminRes.body.token);
    assert.equal(adminRes.body.account.role, 'admin');
    adminToken = adminRes.body.token;

    // Supervisor login by phone
    const supRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: supAcc.phone, password: 'TestPass123!' }),
    });
    assert.equal(supRes.status, 200);
    assert.ok(supRes.body.token);
    assert.equal(supRes.body.account.role, 'supervisor');
    supervisorToken = supRes.body.token;

    // /api/auth/me
    const meRes = await apiFetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.role, 'supervisor');

    // Unauthenticated /api/auth/me -> 401
    const unauthRes = await apiFetch('/api/auth/me');
    assert.equal(unauthRes.status, 401);
  });

  it('Enforces RBAC: Supervisor blocked from Admin routes (403) but allowed on Roster/Sites read', async () => {
    const supHeaders = { Authorization: `Bearer ${supervisorToken}` };

    const adminOnlyEndpoints = [
      { method: 'GET', path: '/api/parties' },
      { method: 'GET', path: '/api/invoices' },
      { method: 'GET', path: '/api/quotations' },
      { method: 'GET', path: '/api/services' },
      { method: 'GET', path: '/api/subcontractors' },
      { method: 'GET', path: '/api/admin/supervisors' },
      { method: 'GET', path: '/api/payouts/summary?startDate=2026-11-23&endDate=2026-11-28' },
    ];

    for (const ep of adminOnlyEndpoints) {
      const res = await apiFetch(ep.path, { method: ep.method, headers: supHeaders });
      assert.equal(res.status, 403, `Expected 403 for supervisor on ${ep.method} ${ep.path}`);
    }

    const allowedSites = await apiFetch('/api/sites', { headers: supHeaders });
    assert.equal(allowedSites.status, 200);

    const allowedRoster = await apiFetch('/api/attendance/roster?date=2026-11-28', {
      headers: supHeaders,
    });
    assert.equal(allowedRoster.status, 200);
  });

  it('Attendance save + copy preserves halfSlot (second_half) and history populates confirmedBy', async () => {
    const adminHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };
    const supHeaders = {
      Authorization: `Bearer ${supervisorToken}`,
      'Content-Type': 'application/json',
    };

    const party = await Party.create({ name: '__autotest_party', phone: '9000000001' });
    createdIds.parties.push(party._id);

    const site = await Site.create({
      siteNumber: `SITE-AT-${Date.now()}`,
      name: '__autotest_site',
      party: party._id,
      status: 'in_progress',
    });
    createdIds.sites.push(site._id);

    const labour = await Labour.create({
      name: '__autotest_labour',
      dailyWage: 900,
      skill: 'Painter',
      isActive: true,
    });
    createdIds.labours.push(labour._id);

    const date1 = '2099-01-10';
    const date2 = '2099-01-11';

    // Save afternoon-only shift via Supervisor token
    const saveRes = await apiFetch('/api/attendance/save', {
      method: 'POST',
      headers: supHeaders,
      body: JSON.stringify({
        dateString: date1,
        records: [
          {
            labourId: labour._id.toString(),
            status: 'half_day',
            shifts: [
              {
                siteId: site._id.toString(),
                shiftType: 'half_day',
                halfSlot: 'second_half',
                units: 0.5,
              },
            ],
            advanceAmount: 150,
            advanceNotes: 'Lunch',
          },
        ],
      }),
    });
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.savedCount, 1);

    // Copy to date2
    const copyRes = await apiFetch('/api/attendance/copy', {
      method: 'POST',
      headers: supHeaders,
      body: JSON.stringify({ fromDate: date1, toDate: date2 }),
    });
    assert.equal(copyRes.status, 200);
    assert.equal(copyRes.body.copiedCount, 1);

    // Verify copied record kept halfSlot === 'second_half'
    const copiedDocs = await LabourAttendance.find({
      labour: labour._id,
      dateString: { $in: [date1, date2] },
    });
    copiedDocs.forEach((d) => createdIds.attendances.push(d._id));

    const doc2 = copiedDocs.find((d) => d.dateString === date2);
    assert.ok(doc2);
    assert.equal(doc2.shifts[0].halfSlot, 'second_half');

    // Verify history endpoint populates confirmedBy
    const histRes = await apiFetch(
      `/api/attendance/history?startDate=${date1}&endDate=${date1}&labourId=${labour._id}`,
      { headers: adminHeaders }
    );
    assert.equal(histRes.status, 200);
    assert.equal(histRes.body.length, 1);
    assert.ok(histRes.body[0].confirmedBy?.name);
  });

  it('Material (Paint) Expense uploads challanImage via Multer to uploads/challans and deletes on remove', async () => {
    const siteId = createdIds.sites[0].toString();

    const form = new FormData();
    form.append('expenseType', 'material');
    form.append('title', '__autotest_putty_bags');
    form.append('amount', '2400');
    form.append('date', '2026-11-28');
    form.append('challanNumber', 'CH-AT-777');
    form.append('challanImage', new Blob([TINY_PNG], { type: 'image/png' }), 'challan.png');

    const createRes = await apiFetch(`/api/sites/${siteId}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.challanNumber, 'CH-AT-777');
    assert.match(createRes.body.challanImage, /^\/uploads\/challans\/challan-.*\.png$/);

    const expenseId = createRes.body._id;
    createdIds.expenses.push(expenseId);
    const relPath = createRes.body.challanImage;
    uploadedFilesToClean.push(relPath);

    // Verify file exists on disk and is served via static route
    const diskPath = path.join(__dirname, '..', relPath.replace(/^\//, ''));
    assert.equal(fs.existsSync(diskPath), true);

    const staticRes = await fetch(`${baseUrl}${relPath}`);
    assert.equal(staticRes.status, 200);

    // Delete expense and verify file is removed from disk
    const delRes = await apiFetch(`/api/sites/${siteId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delRes.status, 200);
    assert.equal(fs.existsSync(diskPath), false);
  });

  it('Payment QR Code uploads via Multer to uploads/qr and is served statically', async () => {
    const form = new FormData();
    form.append('companyName', originalSettingsSnapshot?.companyName || 'SANJEEVANI ENTERPRISE');
    form.append('qrCodeImage', new Blob([TINY_PNG], { type: 'image/png' }), 'qr.png');

    const putRes = await apiFetch('/api/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(putRes.status, 200);
    assert.match(putRes.body.qrCodeImage, /^\/uploads\/qr\/qr-.*\.png$/);

    const relPath = putRes.body.qrCodeImage;
    uploadedFilesToClean.push(relPath);

    const diskPath = path.join(__dirname, '..', relPath.replace(/^\//, ''));
    assert.equal(fs.existsSync(diskPath), true);

    const staticRes = await fetch(`${baseUrl}${relPath}`);
    assert.equal(staticRes.status, 200);
  });
});
