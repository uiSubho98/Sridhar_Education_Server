import MockTest from "../../models/mockTest.model.js";
import MockeTestQuestion from "../../models/mockTestQuestion.model.js"
import mongoose from "mongoose";


export const createMockTest = async (req, res) => {
    try {
        const { title, description, category, subject, mockTestType, isPaid, price, requiresCode, validCodes, totalQuestions, durationMinutes, questionIds, createdBy, isActive } = req.body;
        const newMockTest = new MockTest({
            title,
            description,
            category,
            subject,
            mockTestType,
            isPaid,
            price,
            requiresCode,
            validCodes,
            totalQuestions,
            durationMinutes,
            questionIds,
            createdBy,
            isActive
        });

        const savedMockTest = await newMockTest.save();
        return res.status(201).json({
            message: "Mock Test created successfully",
            savedMockTest
        });
    } catch (error) {
        console.error('Error creating mocktest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const createMockTestQuestion = async (req, res) => {
    try {
        const { testId, questions } = req.body;

        // Validate testId and questions array
        if (!testId) {
            return res.status(400).json({ error: "testId is required" });
        }
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: "Questions should be a non-empty array" });
        }

        // Step 1 - Align question field names exactly as sent by frontend
        const questionDocs = questions.map((q) => {
            // Step 2 - Map options from the frontend options, use opt.answer directly, fallback to image
            const optionsFormatted = q.options.map((opt, index) => ({
                optionNumber: index + 1,
                answer: opt.answer || (opt.image ? opt.image : ""), // Use answer if exists, else image URL
            }));

            return {
                testId,
                questionText: q.questionText || "",          // Use questionText key (not q.text)
                isImageExists: !!q.questionImage,
                questionImage: q.questionImage || "",
                timeQuestion: q.timeQuestion || "",
                options: optionsFormatted,
                correctAnswerIndex:  // Use provided index or parse from correctAns string
                    typeof q.correctAnswerIndex === "number"
                        ? q.correctAnswerIndex
                        : parseInt(q.correctAns, 10) - 1,
                isActive: q.isActive !== undefined ? q.isActive : true,
            };
        });

        // Step 3 - Insert mapped questions
        const savedQuestions = await MockeTestQuestion.insertMany(questionDocs);
        const questionIds = savedQuestions.map(q => q._id);

        // Step 4 - Update MockTest with questionIds array
        const updatedMockTest = await MockTest.findOneAndUpdate(
            { _id: testId },
            { questionIds: questionIds },
            { new: true }
        );

        // Step 5 - Send success response
        res.status(201).json({ message: "Questions created successfully", data: savedQuestions });
    } catch (error) {
        console.error("Error creating mock test questions:", error);
        res.status(500).json({ error: "Server error while creating mock test questions" });
    }
};



export const GetAllMockTest = async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page) : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const search = req.query.search || "";
        const filter = req.query.filter || "";
        const from = req.query.from;
        const to = req.query.to;
        const isPaid = req.query.isPaid;

        // Build the query object for MockTest filtering

        let query = {};

        if (isPaid !== undefined) {
            query.isPaid = isPaid === "true";
        }

        if (search) {
            const searchRegex = { $regex: search, $options: "i" };
            query.$or = [
                { subject: searchRegex },
                { description: searchRegex },
                { category: searchRegex },
                { title: searchRegex },
            ];

            if (!isNaN(Number(search))) {
                query.$or.push({ numberOfModules: Number(search) });
            }
        }

        if (filter === "today") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        } else if (filter === "week") {
            const now = new Date();
            const first = now.getDate() - now.getDay();
            const start = new Date(now.setDate(first));
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        } else if (filter === "month") {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        } else if (filter === "year") {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        } else if (filter === "custom" && from && to) {
            query.createdAt = { $gte: new Date(from), $lte: new Date(to) };
        }

        // Build aggregation pipeline
        const pipeline = [{ $match: query }];

        // $lookup to join MockTestQuestion
        pipeline.push({
            $lookup: {
                from: "mocktestquestions", // MongoDB collection name for MockTestQuestion
                localField: "_id",
                foreignField: "testId",
                as: "questions",
            },
        });

        // Optional: project fields including joined questions
        pipeline.push({
            $project: {
                title: 1,
                description: 1,
                category: 1,
                subject: 1,
                mockTestType: 1,
                isPaid: 1,
                price: 1,
                requiresCode: 1,
                validCodes: 1,
                totalQuestions: 1,
                durationMinutes: 1,
                createdBy: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1,
                questions: 1,
            },
        });

        // Pagination if applicable
        if (page && limit) {
            const skip = (page - 1) * limit;
            pipeline.push({ $skip: skip });
            pipeline.push({ $limit: limit });
        }

        // Execute aggregation
        const mockTests = await MockTest.aggregate(pipeline);

        // Get total count for the query (without pagination)
        const totalCount = await MockTest.countDocuments(query);

        res.json({ success: true, mockTests, totalCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const DeleteMocket = async (req, res) => {
    try {
        const { id } = req.params;         // id from URL param
        const { type } = req.body;         // 'soft' or 'hard' from request body

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid MockTest ID" });
        }

        // Validate type
        if (type !== "soft" && type !== "hard") {
            return res.status(400).json({ message: "Invalid delete type" });
        }

        if (type === "hard") {
            // Hard delete MockTest
            const mockTestDeleteResult = await MockTest.deleteOne({ _id: id });
            if (mockTestDeleteResult.deletedCount === 0) {
                return res.status(404).json({ message: "MockTest not found" });
            }
            // Hard delete related MockTestQuestions
            await MockeTestQuestion.deleteMany({ testId: id });

            return res
                .status(200)
                .json({ message: "Hard delete successful, mock test and related questions removed" });
        } else {
            // Soft delete: set isActive = false for MockTest and questions
            const mockTest = await MockTest.findOneAndUpdate(
                { _id: id, isActive: true },
                { isActive: false },
                { new: true }
            );
            if (!mockTest) {
                return res.status(404).json({ message: "MockTest not found or already inactive" });
            }
            await MockeTestQuestion.updateMany({ testId: id, isActive: true }, { isActive: false });

            return res.status(200).json({
                message: "Soft delete successful, mock test and related questions deactivated",
                mockTest,
            });
        }
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


export const updateMockTestWithQuestions = async (req, res) => {
    try {
        const { testId, mockTestData, questions } = req.body;

        if (!testId) {
            return res.status(400).json({ error: "testId is required" });
        }
        if (!mockTestData) {
            return res.status(400).json({ error: "mockTestData is required" });
        }

        let questionIds = [];

        if (Array.isArray(questions) && questions.length > 0) {
            for (const q of questions) {
                // Format options using the answer field directly
                const optionsFormatted = (q.options || []).map((opt, index) => ({
                    optionNumber: index + 1,
                    answer: opt.answer || "",
                }));

                const questionData = {
                    testId,
                    questionText: q.questionText || q.text || "",
                    isImageExists: !!q.questionImage && q.questionImage !== "",
                    questionImage: q.questionImage || null,
                    timeQuestion: q.timeQuestion || q.time || "",
                    options: optionsFormatted,
                    correctAnswerIndex:
                        typeof q.correctAnswerIndex === "number"
                            ? q.correctAnswerIndex
                            : (q.correctAns ? parseInt(q.correctAns, 10) - 1 : 0),
                    isActive: q.isActive !== undefined ? q.isActive : true,
                };

                if (q._id) {
                    // Update existing question by fetching and saving to ensure nested arrays update properly
                    const existingQuestion = await MockeTestQuestion.findById(q._id);
                    if (existingQuestion) {
                        existingQuestion.testId = questionData.testId;
                        existingQuestion.questionText = questionData.questionText;
                        existingQuestion.isImageExists = questionData.isImageExists;
                        existingQuestion.questionImage = questionData.questionImage;
                        existingQuestion.timeQuestion = questionData.timeQuestion;
                        existingQuestion.options = questionData.options;
                        existingQuestion.correctAnswerIndex = questionData.correctAnswerIndex;
                        existingQuestion.isActive = questionData.isActive;

                        const savedQuestion = await existingQuestion.save();
                        questionIds.push(savedQuestion._id);
                    } else {
                        // If existing question not found, create new
                        const newQuestion = new MockeTestQuestion(questionData);
                        const savedQuestion = await newQuestion.save();
                        questionIds.push(savedQuestion._id);
                    }
                } else {
                    // Create new question if no _id
                    const newQuestion = new MockeTestQuestion(questionData);
                    const savedQuestion = await newQuestion.save();
                    questionIds.push(savedQuestion._id);
                }
            }
        }

        // Build update data for MockTest model
        const updateData = {
            title: mockTestData.title,
            description: mockTestData.description,
            category: mockTestData.category,
            subject: mockTestData.subject,
            mockTestType: mockTestData.mockTestType || mockTestData.testType,
            isPaid: mockTestData.isPaid !== undefined ? mockTestData.isPaid : mockTestData.testType === "paid",
            price: mockTestData.price || mockTestData.mockTestPrice || 0,
            validCodes: mockTestData.validCodes || [],
            requiresCode:
                mockTestData.requiresCode !== undefined
                    ? mockTestData.requiresCode
                    : (mockTestData.validCodes?.length > 0),
            totalQuestions: mockTestData.totalQuestions || mockTestData.totalQuestion || 0,
            durationMinutes: mockTestData.durationMinutes || mockTestData.totalMinutes || 0,
            createdBy: mockTestData.createdBy || mockTestData.userId || null,
            isActive: mockTestData.isActive !== undefined ? mockTestData.isActive : true,
        };

        if (questionIds.length > 0) {
            updateData.questionIds = questionIds;
        }

        const updatedMockTest = await MockTest.findByIdAndUpdate(testId, updateData, {
            new: true,
            runValidators: true,
        });

        if (!updatedMockTest) {
            return res.status(404).json({ error: "MockTest not found" });
        }

        res.status(200).json({ message: "MockTest updated successfully", data: updatedMockTest });
    } catch (error) {
        console.error("Error updating mock test with questions:", error);
        res.status(500).json({ error: "Server error while updating mock test" });
    }
};

export const GetMockTestById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid MockTest ID" });
        }
        const mockTest = await MockTest.findById(id).lean();
        if (!mockTest) {
            return res.status(404).json({ message: "MockTest not found" });
        }
        const questions = await MockeTestQuestion.find({
            testId: id
        }).lean();

        res.status(200).json({ success: true, mockTest: { ...mockTest, questions } });
    }
    catch (error) { 
        console.error("Error fetching mock test by ID:", error);
        res.status(500).json({ error: "Server error while fetching mock test" });
    }
};