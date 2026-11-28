const express = require('express');
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} = require('../controllers/service.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.route('/').get(getServices).post(createService);
router.route('/:id').get(getServiceById).put(updateService).delete(deleteService);

module.exports = router;
