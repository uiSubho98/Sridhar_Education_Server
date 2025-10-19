import Payment from "../../models/payment.model.js";


export const createPayment = async (req, res) => {
  try {
    const newPayment = new Payment(req.body);
    const savedPayments = await newPayment.save();
    res.status(201).json(savedPayments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllPaymentHistory = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const search = req.query.search || "";
    const filter = req.query.filter || "";
    const from = req.query.from;
    const to = req.query.to;

    // Build date filter based on filter query param
    let dateFilter = {};
    const now = new Date();
    if (filter === "today") {
      const start = new Date(now.setHours(0, 0, 0, 0));
      const end = new Date(now.setHours(23, 59, 59, 999));
      dateFilter = { $gte: start, $lte: end };
    } else if (filter === "week") {
      const first = now.getDate() - now.getDay();
      const start = new Date(now.setDate(first));
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else if (filter === "custom" && from && to) {
      dateFilter = { $gte: new Date(from), $lte: new Date(to) };
    }

    // Construct aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "mocktests",
          localField: "mockId",
          foreignField: "_id",
          as: "mockTestDetails",
        },
      },
      { $unwind: { path: "$mockTestDetails", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseDetails",
        },
      },
      { $unwind: { path: "$courseDetails", preserveNullAndEmptyArrays: true } },

      {
        $match: {
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          ...(search && {
            $or: [
              { "userDetails.email": { $regex: search, $options: "i" } },
              { "mockTestDetails.title": { $regex: search, $options: "i" } },
              { "courseDetails.name": { $regex: search, $options: "i" } },
              { transactionId: { $regex: search, $options: "i" } },
            ],
          }),
        },
      },

      {
        $project: {
          amount: 1,
          paymentStatus: 1,
          transactionId: 1,
          responsePayload: 1,
          couponCode: 1,
          paidAt: 1,
          createdAt: 1,
          updatedAt: 1,
          userDetails: { email: 1 },
          mockTestDetails: { title: 1 },
          courseDetails: { name: 1 },
        },
      },

      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    // Execute aggregation pipeline
    const payments = await Payment.aggregate(pipeline);

    // Get total count without pagination stages for accurate total
    const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage));
    countPipeline.push({ $count: "totalCount" });
    const countResult = await Payment.aggregate(countPipeline);
    const totalCount = countResult.length ? countResult[0].totalCount : 0;

    res.json({
      success: true,
      data: payments,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const userSummary = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const search = req.query.search || "";
    const filter = req.query.filter || "";
    const from = req.query.from;
    const to = req.query.to;

    // Escape special regex characters in search string
    const escapeRegex = (text) =>
      text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

    let userMatch = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      userMatch.$or = [
        { "user.email": searchRegex },
        { "user.deviceId": searchRegex },
      ];
    }

    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      userMatch["user.createdAt"] = { $gte: start, $lte: end };
    } else if (filter === "week") {
      const now = new Date();
      const first = now.getDate() - now.getDay();
      const start = new Date(now.setDate(first));
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      userMatch["user.createdAt"] = { $gte: start, $lte: end };
    } else if (filter === "month") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      userMatch["user.createdAt"] = { $gte: start, $lte: end };
    } else if (filter === "year") {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      userMatch["user.createdAt"] = { $gte: start, $lte: end };
    } else if (filter === "custom" && from && to) {
      userMatch["user.createdAt"] = { $gte: new Date(from), $lte: new Date(to) };
    }

    const basePipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: userMatch }, // Match on nested user fields here
      {
        $group: {
          _id: "$userId",
          email: { $first: "$user.email" },
          deviceId: { $first: "$user.deviceId" },
          createdAt: { $first: "$user.createdAt" },
          purchasedCourses: { $addToSet: "$courseId" },
          purchasedMocks: { $addToSet: "$mockId" },
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          deviceId: 1,
          createdAt: 1,
          courseCount: {
            $size: {
              $filter: {
                input: "$purchasedCourses",
                as: "course",
                cond: { $ne: ["$$course", null] },
              },
            },
          },
          mockTestCount: {
            $size: {
              $filter: {
                input: "$purchasedMocks",
                as: "mock",
                cond: { $ne: ["$$mock", null] },
              },
            },
          },
        },
      },
    ];

    const pipeline = [
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [...basePipeline, { $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];

    const result = await Payment.aggregate(pipeline);

    const total = result[0].data.length || 0;
    const data = result[0].data;

    return res.json({
      total,
      page,
      limit,
      data,
    });
  } catch (err) {
    console.error("Error fetching user purchases summary with total count:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

