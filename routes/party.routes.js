const express = require('express');
const {
  getParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
} = require('../controllers/party.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getParties).post(createParty);
router.route('/:id').get(getPartyById).put(updateParty).delete(deleteParty);

module.exports = router;
