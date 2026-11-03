const { PROGRAMS } = require('../config/programs');

const getPrograms = (req, res) => {
  return res.json({ success: true, data: PROGRAMS });
};

module.exports = { getPrograms };
