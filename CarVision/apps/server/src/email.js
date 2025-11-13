// apps/server/src/email.js - Email service using nodemailer
"use strict";
const nodemailer = require("nodemailer");

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587", 10);
const EMAIL_USER = process.env.EMAIL_USER || ""; // Your email
const EMAIL_PASS = process.env.EMAIL_PASS || ""; // Your email password or app password
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || "noreply@carvision.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8081"; // Expo default or your app URL

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: EMAIL_USER && EMAIL_PASS ? {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      } : undefined,
    });
  }
  return transporter;
}

// Verify email configuration
async function verifyEmailConfig() {
  try {
    const trans = getTransporter();
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️  Email credentials not configured. Emails will not be sent.");
      return false;
    }
    await trans.verify();
    console.log("✅ Email service configured and verified");
    return true;
  } catch (error) {
    console.warn("⚠️  Email service verification failed:", error.message);
    console.warn("   Emails will not be sent. Check your EMAIL_* environment variables.");
    return false;
  }
}

// Send welcome email on signup
async function sendWelcomeEmail(user) {
  try {
    const isConfigured = await verifyEmailConfig();
    if (!isConfigured) {
      console.log("📧 Welcome email skipped (email not configured)");
      return { ok: false, error: "Email service not configured" };
    }

    const transporter = getTransporter();
    const mailOptions = {
      from: `CarVision <${EMAIL_FROM}>`,
      to: user.email,
      subject: "Welcome to CarVision! 🚗",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7C8CFF 0%, #6F7CFF 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #7C8CFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 Welcome to CarVision!</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.name || user.email.split("@")[0]}!</h2>
              <p>Thank you for signing up for CarVision - your smart vehicle diagnostics platform.</p>
              <p>Your account has been successfully created with the following details:</p>
              <ul>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Role:</strong> ${user.role || "CLIENT"}</li>
              </ul>
              <p>You can now:</p>
              <ul>
                <li>Connect to your OBD-II adapter</li>
                <li>Monitor real-time vehicle data</li>
                <li>Read and clear diagnostic trouble codes</li>
                <li>Get AI-powered repair suggestions</li>
              </ul>
              <p>Get started by logging into your account and connecting your vehicle diagnostics adapter.</p>
              <p style="margin-top: 30px;">If you have any questions, feel free to reach out to our support team.</p>
              <p>Happy driving! 🛣️</p>
              <p style="margin-top: 30px;"><strong>The CarVision Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2025 CarVision. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to CarVision!

Hello ${user.name || user.email.split("@")[0]}!

Thank you for signing up for CarVision - your smart vehicle diagnostics platform.

Your account has been successfully created:
- Email: ${user.email}
- Role: ${user.role || "CLIENT"}

You can now:
- Connect to your OBD-II adapter
- Monitor real-time vehicle data
- Read and clear diagnostic trouble codes
- Get AI-powered repair suggestions

Get started by logging into your account and connecting your vehicle diagnostics adapter.

If you have any questions, feel free to reach out to our support team.

Happy driving!

The CarVision Team

---
This is an automated email. Please do not reply.
© 2025 CarVision. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Welcome email sent to ${user.email}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send welcome email:", error);
    return { ok: false, error: error.message };
  }
}

// Send password reset email
async function sendPasswordResetEmail(user, resetToken) {
  try {
    const isConfigured = await verifyEmailConfig();
    if (!isConfigured) {
      console.log("📧 Password reset email skipped (email not configured)");
      // For development, return token in response (remove in production)
      return { ok: false, error: "Email service not configured", resetToken };
    }

    const transporter = getTransporter();
    
    // Create reset link - use server route that redirects to app
    // The link will be: http://your-server:5173/reset-password/:token
    // This route redirects to the mobile app with the token
    // For production, use your actual server URL (e.g., https://yourdomain.com)
    const HTTP_PORT = process.env.HTTP_PORT || 5173;
    const SERVER_URL = process.env.SERVER_URL || `http://localhost:${HTTP_PORT}`;
    const resetLink = `${SERVER_URL}/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: `CarVision <${EMAIL_FROM}>`,
      to: user.email,
      subject: "Reset Your CarVision Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7C8CFF 0%, #6F7CFF 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #7C8CFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .token-box { background: #e9ecef; padding: 15px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.name || user.email.split("@")[0]}!</h2>
              <p>We received a request to reset your password for your CarVision account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <div class="token-box">${resetLink}</div>
              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>For security, never share this link with anyone</li>
                </ul>
              </div>
              <p>If you have any questions or concerns, please contact our support team.</p>
              <p style="margin-top: 30px;"><strong>The CarVision Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2025 CarVision. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

Hello ${user.name || user.email.split("@")[0]}!

We received a request to reset your password for your CarVision account.

Click the link below to reset your password:
${resetLink}

Or copy and paste this link into your browser:
${resetLink}

⚠️ Important:
- This link will expire in 1 hour
- If you didn't request this, please ignore this email
- For security, never share this link with anyone

If you have any questions or concerns, please contact our support team.

The CarVision Team

---
This is an automated email. Please do not reply.
© 2025 CarVision. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${user.email}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    return { ok: false, error: error.message };
  }
}

// Verify email config on module load
verifyEmailConfig().catch(console.error);

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
};

