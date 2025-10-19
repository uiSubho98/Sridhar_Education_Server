import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { config } from "../config/config.js";


export const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // or 587 for TLS
      secure: true, // true for 465, false for 587
      auth: {
        user: config.EMAIL_USER, // your Gmail
        pass: config.EMAIL_PASS, // Gmail App Password
      },
    });

    await transporter.sendMail({
      from: `"Sridhar LMS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw new Error("Email failed to send");
  }
};
