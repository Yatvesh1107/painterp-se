const express = require('express');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');
const {
  getSupervisors,
  createSupervisor,
  updateSupervisor,
  deleteSupervisor,
} = require('../controllers/supervisor.controller');

const router = express.Router();

// Every route in this file is restricted to the admin role.
router.use(protect, authorize(ROLES.ADMIN));

router.get('/dashboard', (req, res) => {
  res.status(200).json({
    message: 'Admin panel placeholder',
    account: {
      id: req.account._id,
      name: req.account.name,
      role: req.account.role,
    },
  });
});

// Supervisor Account Management
router.get('/supervisors', getSupervisors);
router.post('/supervisors', createSupervisor);
router.put('/supervisors/:id', updateSupervisor);
router.delete('/supervisors/:id', deleteSupervisor);

module.exports = router;
