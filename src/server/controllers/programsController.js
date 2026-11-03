const { PROGRAMS, FACULTIES } = require('../config/programs');

const getPrograms = (req, res) => {
  return res.json({ success: true, data: PROGRAMS, faculties: FACULTIES });
};

module.exports = { getPrograms };
