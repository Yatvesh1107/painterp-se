const express = require('express');
const {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
} = require('../controllers/site.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getSites).post(createSite);
router.route('/:id').get(getSiteById).put(updateSite).delete(deleteSite);

module.exports = router;
