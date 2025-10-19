import DeviceChangeRequest from "../../../models/deviceChangeRequest.model.js";

export const raiseDeviceChangeRequest = async (req, res) => {
  try {
    const { userId, PreviousDeviceId, newDeviceId, reason } = req.body;

    if (!userId || !PreviousDeviceId || !newDeviceId || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newRequest = new DeviceChangeRequest({
      userId,
      PreviousDeviceId,
      newDeviceId,
      reason,
    });

    await newRequest.save();

    res.status(201).json({
      message: "Device change request submitted",
      request: newRequest,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
