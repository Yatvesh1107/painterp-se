const express = require('express');
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} = require('../controllers/service.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getServices).post(createService);
router.route('/:id').get(getServiceById).put(updateService).delete(deleteService);

module.exports = router;
