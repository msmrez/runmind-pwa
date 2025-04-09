// backend/controllers/insightController.js
const analyticsService = require("../services/analyticsService");

exports.getInsights = async (req, res, next) => {
  const userId = req.user.userId;
  console.log(`[Insight Ctrl] GET / - User: ${userId}`);
  try {
    // Delegate the complex logic to the service
    const insightsArray = await analyticsService.generateInsights(userId);
    res.status(200).json({ insights: insightsArray });
  } catch (error) {
    // Pass error to global handler
    next(error);
  }
};
