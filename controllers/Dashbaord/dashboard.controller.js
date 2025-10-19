import User from "../../models/user.model.js";
import Course from "../../models/course.model.js"
import Payment from "../../models/payment.model.js";
import MockTest from "../../models/mockTest.model.js"

export const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalCourses = await Course.countDocuments({ isActive: true });
        const totalPaymentsAmountAgg = await Payment.aggregate([
            { $match: { paymentStatus: "Completed"} },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
        ]);
        const totalMockTests = await MockTest.countDocuments({ isActive: true });

        const totalPaymentsAmount = totalPaymentsAmountAgg[0]?.totalAmount || 0;

        res.status(200).json({
            totalUsers,
            totalCourses,
            totalPaymentsAmount,
            totalMockTests
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



export const lineChart = async (req, res) => {
  try {
    // Parse year from query param
    const yearFilter = req.query.year ? parseInt(req.query.year, 10) : null;

    const matchStage = {
      paymentStatus: "Completed",
      $or: [{ courseId: { $ne: null } }, { mockId: { $ne: null } }],
    };

    if (yearFilter) {
      // Filter payments by createdAt year
      matchStage.createdAt = {
        $gte: new Date(yearFilter, 0, 1),       // Jan 1, yearFilter
        $lt: new Date(yearFilter + 1, 0, 1),    // Jan 1, yearFilter+1
      };
    }

    const data = await Payment.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
        },
      },
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          MockTestPurchased: {
            $sum: { $cond: [{ $ifNull: ["$mockId", false] }, "$amount", 0] },
          },
          TotalCoursePurchased: {
            $sum: { $cond: [{ $ifNull: ["$courseId", false] }, "$amount", 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const currentYear =
      yearFilter || (data.length > 0 ? data[data.length - 1]._id.year : new Date().getFullYear());

    const formattedData = [];
    for (let i = 1; i <= 12; i++) {
      const monthData = data.find(item => item._id.month === i && item._id.year === currentYear);
      formattedData.push({
        month: monthNames[i - 1],
        MockTestPurchased: monthData ? monthData.MockTestPurchased : 0,
        TotalCoursePurchased: monthData ? monthData.TotalCoursePurchased : 0,
      });
    }

    res.json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};



