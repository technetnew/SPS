const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Rate limit tracking for contact form (simple in-memory store)
const contactAttempts = new Map();
const CONTACT_RATE_LIMIT = 3; // Max 3 submissions per hour per IP
const CONTACT_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of contactAttempts) {
        if (now - data.firstAttempt > CONTACT_RATE_WINDOW) {
            contactAttempts.delete(ip);
        }
    }
}, 10 * 60 * 1000); // Clean every 10 minutes

// Simple captcha verification
function verifyCaptcha(userAnswer, correctAnswer) {
    return userAnswer && correctAnswer &&
           String(userAnswer).trim() === String(correctAnswer).trim();
}

// Rate limiting middleware for contact form
function contactRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (contactAttempts.has(ip)) {
        const data = contactAttempts.get(ip);

        // Reset if window has passed
        if (now - data.firstAttempt > CONTACT_RATE_WINDOW) {
            contactAttempts.set(ip, { firstAttempt: now, count: 1 });
        } else if (data.count >= CONTACT_RATE_LIMIT) {
            return res.status(429).json({
                error: 'Too many contact attempts. Please try again later.',
                retryAfter: Math.ceil((data.firstAttempt + CONTACT_RATE_WINDOW - now) / 60000)
            });
        } else {
            data.count++;
        }
    } else {
        contactAttempts.set(ip, { firstAttempt: now, count: 1 });
    }

    next();
}

// Create reusable transporter
function createTransporter() {
    const port = parseInt(process.env.SMTP_PORT) || 587;

    // Determine security settings based on port and env vars
    // Port 465 = SSL/TLS (secure: true)
    // Port 587 = STARTTLS (secure: false, but upgrades via STARTTLS)
    // Port 25/2525 = Usually plain or STARTTLS
    const isSecurePort = port === 465;
    const useSecure = process.env.SMTP_SECURE === 'true' || isSecurePort;

    const transportConfig = {
        host: process.env.SMTP_HOST || 'mail.smtp2go.com',
        port: port,
        secure: useSecure, // true for 465 (SSL), false for other ports (use STARTTLS)
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        // TLS options
        tls: {
            // Don't fail on invalid certs (useful for self-signed certs in dev)
            rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
            // Minimum TLS version
            minVersion: 'TLSv1.2'
        }
    };

    // Optional: require TLS upgrade for non-secure ports (STARTTLS)
    if (!useSecure && process.env.SMTP_REQUIRE_TLS === 'true') {
        transportConfig.requireTLS = true;
    }

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
        transportConfig.debug = true;
        transportConfig.logger = true;
    }

    return nodemailer.createTransport(transportConfig);
}

// Generate simple math captcha
router.get('/captcha', (req, res) => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let answer;
    let question;

    if (operator === '+') {
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
    } else {
        // Ensure positive result for subtraction
        const larger = Math.max(num1, num2);
        const smaller = Math.min(num1, num2);
        answer = larger - smaller;
        question = `${larger} - ${smaller}`;
    }

    // Store answer in a simple token (in production, use session or encrypted token)
    const captchaId = Buffer.from(JSON.stringify({ answer, expires: Date.now() + 5 * 60 * 1000 }))
        .toString('base64');

    res.json({
        question: `What is ${question}?`,
        captchaId
    });
});

// Verify captcha token
function verifyCaptchaToken(captchaId, userAnswer) {
    try {
        const decoded = JSON.parse(Buffer.from(captchaId, 'base64').toString());

        if (Date.now() > decoded.expires) {
            return { valid: false, error: 'Captcha expired. Please refresh and try again.' };
        }

        if (parseInt(userAnswer) !== decoded.answer) {
            return { valid: false, error: 'Incorrect captcha answer. Please try again.' };
        }

        return { valid: true };
    } catch (err) {
        return { valid: false, error: 'Invalid captcha. Please refresh and try again.' };
    }
}

// Send contact form message
router.post('/send', contactRateLimit, async (req, res) => {
    try {
        const { name, email, subject, message, captchaId, captchaAnswer } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required.' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        // Verify captcha
        if (!captchaId || !captchaAnswer) {
            return res.status(400).json({ error: 'Please complete the captcha verification.' });
        }

        const captchaResult = verifyCaptchaToken(captchaId, captchaAnswer);
        if (!captchaResult.valid) {
            return res.status(400).json({ error: captchaResult.error });
        }

        // Sanitize inputs (basic XSS prevention)
        const sanitize = (str) => String(str).replace(/[<>]/g, '').trim().slice(0, 1000);
        const sanitizedName = sanitize(name).slice(0, 100);
        const sanitizedSubject = subject ? sanitize(subject).slice(0, 200) : 'Contact Form Submission';
        const sanitizedMessage = sanitize(message).slice(0, 5000);

        // Check if SMTP is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('[Contact] SMTP not configured. Message received:', {
                name: sanitizedName,
                email,
                subject: sanitizedSubject,
                message: sanitizedMessage.slice(0, 100) + '...'
            });

            // In development/unconfigured state, just log and return success
            return res.json({
                success: true,
                message: 'Thank you for your message. We will get back to you soon.'
            });
        }

        // Create transporter and send email
        const transporter = createTransporter();

        const mailOptions = {
            from: `"SPS Contact Form" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
            replyTo: email,
            subject: `[SPS Contact] ${sanitizedSubject}`,
            text: `
Name: ${sanitizedName}
Email: ${email}
Subject: ${sanitizedSubject}

Message:
${sanitizedMessage}

---
Sent from SPS Contact Form
IP: ${req.ip || 'Unknown'}
Time: ${new Date().toISOString()}
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5f2d; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #2c5f2d; }
        .message { background: white; padding: 15px; border-left: 4px solid #2c5f2d; margin-top: 20px; }
        .footer { font-size: 12px; color: #666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>New Contact Form Submission</h2>
        </div>
        <div class="content">
            <div class="field">
                <span class="label">Name:</span> ${sanitizedName}
            </div>
            <div class="field">
                <span class="label">Email:</span> <a href="mailto:${email}">${email}</a>
            </div>
            <div class="field">
                <span class="label">Subject:</span> ${sanitizedSubject}
            </div>
            <div class="message">
                <span class="label">Message:</span>
                <p>${sanitizedMessage.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="footer">
                <p>Sent from SPS Contact Form</p>
                <p>IP: ${req.ip || 'Unknown'} | Time: ${new Date().toISOString()}</p>
            </div>
        </div>
    </div>
</body>
</html>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log('[Contact] Email sent successfully from:', email);

        res.json({
            success: true,
            message: 'Thank you for your message. We will get back to you soon.'
        });

    } catch (error) {
        console.error('[Contact] Error sending email:', error);
        res.status(500).json({
            error: 'Failed to send message. Please try again later.'
        });
    }
});

// Test SMTP connection (admin only, no auth for simplicity)
router.get('/test-smtp', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not available in production' });
    }

    try {
        const transporter = createTransporter();
        await transporter.verify();
        res.json({ success: true, message: 'SMTP connection successful' });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env'
        });
    }
});

module.exports = router;
