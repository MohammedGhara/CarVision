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

// Send password reset email with 6-digit code
async function sendPasswordResetEmail(user, resetCode) {
  try {
    const isConfigured = await verifyEmailConfig();
    if (!isConfigured) {
      console.log("📧 Password reset email skipped (email not configured)");
      // For development, return code in response
      return { ok: false, error: "Email service not configured", resetCode };
    }

    const transporter = getTransporter();
    
    const mailOptions = {
      from: `CarVision <${EMAIL_FROM}>`,
      to: user.email,
      subject: "Your CarVision Password Reset Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7C8CFF 0%, #6F7CFF 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: #ffffff; border: 3px solid #7C8CFF; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 36px; font-weight: bold; color: #7C8CFF; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Code</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.name || user.email.split("@")[0]}!</h2>
              <p>We received a request to reset your password for your CarVision account.</p>
              <p>Use the verification code below to reset your password:</p>
              <div class="code-box">
                <div class="code">${resetCode}</div>
              </div>
              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This code will expire in 1 hour</li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>For security, never share this code with anyone</li>
                </ul>
              </div>
              <p>Enter this code in the CarVision app to complete your password reset.</p>
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
Password Reset Code

Hello ${user.name || user.email.split("@")[0]}!

We received a request to reset your password for your CarVision account.

Your verification code is: ${resetCode}

Enter this code in the CarVision app to complete your password reset.

⚠️ Important:
- This code will expire in 1 hour
- If you didn't request this, please ignore this email
- For security, never share this code with anyone

If you have any questions or concerns, please contact our support team.

The CarVision Team

---
This is an automated email. Please do not reply.
© 2025 CarVision. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset code sent to ${user.email}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    return { ok: false, error: error.message };
  }
}

// Verify email config on module load
verifyEmailConfig().catch(console.error);

// Send vehicle completion email to client
async function sendVehicleDoneEmail(client, vehicle, garage) {
  try {
    const isConfigured = await verifyEmailConfig();
    if (!isConfigured) {
      console.log("📧 Vehicle done email skipped (email not configured)");
      return { ok: false, error: "Email service not configured" };
    }

    const transporter = getTransporter();
    const mailOptions = {
      from: `CarVision <${EMAIL_FROM}>`,
      to: client.email,
      subject: `✅ Your ${vehicle.make} ${vehicle.model} is Ready!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .vehicle-info { background: #ffffff; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #6b7280; }
            .info-value { color: #111827; }
            .button { display: inline-block; background: #7C8CFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Your Vehicle is Ready!</h1>
            </div>
            <div class="content">
              <h2>Hello ${client.name || client.email.split("@")[0]}!</h2>
              <p>Great news! Your vehicle has been completed and is ready for pickup.</p>
              
              <div class="vehicle-info">
                <h3 style="margin-top: 0; color: #10b981;">Vehicle Details</h3>
                <div class="info-row">
                  <span class="info-label">Make & Model:</span>
                  <span class="info-value">${vehicle.make} ${vehicle.model}</span>
                </div>
                ${vehicle.year ? `<div class="info-row">
                  <span class="info-label">Year:</span>
                  <span class="info-value">${vehicle.year}</span>
                </div>` : ''}
                ${vehicle.licensePlate ? `<div class="info-row">
                  <span class="info-label">License Plate:</span>
                  <span class="info-value">${vehicle.licensePlate}</span>
                </div>` : ''}
                ${vehicle.vin ? `<div class="info-row">
                  <span class="info-label">VIN:</span>
                  <span class="info-value">${vehicle.vin}</span>
                </div>` : ''}
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="color: #10b981; font-weight: bold;">✅ DONE</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Garage:</span>
                  <span class="info-value">${garage.name}</span>
                </div>
              </div>

              <p>You can now pick up your vehicle from <strong>${garage.name}</strong>.</p>
              <p>Please contact the garage if you have any questions or need to schedule a pickup time.</p>
              
              <p style="margin-top: 30px;">Thank you for using CarVision! 🚗</p>
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
Your Vehicle is Ready!

Hello ${client.name || client.email.split("@")[0]}!

Great news! Your vehicle has been completed and is ready for pickup.

Vehicle Details:
- Make & Model: ${vehicle.make} ${vehicle.model}
${vehicle.year ? `- Year: ${vehicle.year}` : ''}
${vehicle.licensePlate ? `- License Plate: ${vehicle.licensePlate}` : ''}
${vehicle.vin ? `- VIN: ${vehicle.vin}` : ''}
- Status: ✅ DONE
- Garage: ${garage.name}

You can now pick up your vehicle from ${garage.name}.

Please contact the garage if you have any questions or need to schedule a pickup time.

Thank you for using CarVision!

The CarVision Team

---
This is an automated email. Please do not reply.
© 2025 CarVision. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Vehicle done email sent to ${client.email}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send vehicle done email:", error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVehicleDoneEmail,
  verifyEmailConfig,
};

