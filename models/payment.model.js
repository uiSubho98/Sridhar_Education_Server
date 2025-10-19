import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const PaymentSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: Types.ObjectId,
      ref: "Course",
      default: null,
    },
    mockId: {
      type: Types.ObjectId,
      ref: "MockTest",
      default: null,
    },
    amount: Number,
    paymentStatus: String,
    transactionId: String,
    responsePayload: {
      type: Object,
      default: {},
    },
    couponCode: {
      type: String,
      default: null,
    },
    paidAt: Date,
  },
  { timestamps: true }
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);

export default Payment;
