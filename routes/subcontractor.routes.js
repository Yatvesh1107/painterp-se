const express = require('express');
const {
  getSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
} = require('../controllers/subcontractor.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', getSubcontractors);
router.post('/', createSubcontractor);
router.put('/:id', updateSubcontractor);
router.delete('/:id', deleteSubcontractor);

module.exports = router;
