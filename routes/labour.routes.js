const express = require('express');
const {
  getLabours,
  getLabourById,
  createLabour,
  updateLabour,
  deleteLabour,
} = require('../controllers/labour.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect);

router.get('/', getLabours);
router.get('/:id', getLabourById);
router.post('/', createLabour);
router.put('/:id', authorize(ROLES.ADMIN), updateLabour);
router.delete('/:id', authorize(ROLES.ADMIN), deleteLabour);

module.exports = router;
