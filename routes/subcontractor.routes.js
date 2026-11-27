const express = require('express');
const {
  getSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
} = require('../controllers/subcontractor.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getSubcontractors);
router.post('/', createSubcontractor);
router.put('/:id', updateSubcontractor);
router.delete('/:id', deleteSubcontractor);

module.exports = router;
