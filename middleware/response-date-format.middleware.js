const { formatDatesInPayload } = require("../utils/date-format.util");

exports.formatDateResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => originalJson(formatDatesInPayload(body));

  next();
};
