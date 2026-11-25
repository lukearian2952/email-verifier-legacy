const emailValidator = require("email-validator");
const dns = require("dns");
const net = require("net");
const express = require("express");

// Initialize Express app
const app = express();
const port = 4402;

app.use(express.json());

/**
 * Validate if an email exists and classify it into 4 statuses
 */
async function validateEmail(email) {
    if (!emailValidator.validate(email)) {
        console.log("❌ Invalid Email Syntax");
        return "Invalid Syntax";
    }

    const domain = email.split("@")[1];

    // Step 1: Check MX Records
    const mxRecords = await getMXRecords(domain);
    if (!mxRecords.length) {
        console.log("❌ No MX records found. The email is NOT receiving.");
        return "Not Receiving";
    }

    console.log(`✅ MX Records Found: ${JSON.stringify(mxRecords)}`);

    // Step 2: Check if domain is a Catch-All
    const isCatchAll = await checkCatchAll(domain, mxRecords[0].exchange);
    if (isCatchAll) {
        console.log("⚠️ This domain is a Catch-All. Email existence is uncertain.");
        return "Catch-All";
    }

    // Step 3: Verify Email with SMTP
    const emailStatus = await checkSMTP(email, mxRecords[0].exchange);
    console.log(`🔍 Final Result: ${emailStatus}`);
    return emailStatus;
}

/**
 * Get MX records of a domain
 */
function getMXRecords(domain) {
    return new Promise((resolve) => {
        dns.resolveMx(domain, (err, addresses) => {
            if (err) {
                console.error("⚠️ DNS MX lookup failed:", err);
                resolve([]);
            } else {
                resolve(addresses.sort((a, b) => a.priority - b.priority));
            }
        });
    });
}

/**
 * Check if the domain is a catch-all
 */
function checkCatchAll(domain, mailServer) {
    return new Promise((resolve) => {
        const fakeEmail = `randomxyz123@${domain}`;
        const socket = net.createConnection({ port: 587, host: mailServer });

        socket.on("connect", () => {
            socket.write("HELO example.com\r\n");
            socket.write("MAIL FROM:<test@example.com>\r\n");
            socket.write(`RCPT TO:<${fakeEmail}>\r\n`);
        });

        socket.on("data", (data) => {
            if (data.includes("250")) {
                resolve(true); // Catch-All detected
            } else {
                resolve(false);
            }
            socket.end();
        });

        socket.on("error", () => resolve(false));
        socket.on("end", () => resolve(false));
    });
}

/**
 * Verify Email Existence via SMTP
 */
function checkSMTP(email, mailServer) {
    return new Promise((resolve) => {
        const socket = net.createConnection(25, mailServer);
        let stage = 0;

        socket.setTimeout(5000);
        socket.on("timeout", () => {
            console.error("⚠️ SMTP Timeout, assuming UNKNOWN status");
            socket.end();
            resolve("Unknown");
        });

        socket.on("connect", () => {
            console.log(`🔄 Connecting to SMTP server: ${mailServer}`);
            socket.write("HELO example.com\r\n");
        });

        socket.on("data", (data) => {
            if (stage === 0 && data.includes("250")) {
                socket.write("MAIL FROM:<verify@example.com>\r\n");
                stage++;
            } else if (stage === 1 && data.includes("250")) {
                socket.write(`RCPT TO:<${email}>\r\n`);
                stage++;
            } else if (stage === 2) {
                if (data.includes("250")) {
                    resolve("deliverable"); // ✅ Email exists
                } else if (data.includes("550")) {
                    resolve("Not Receiving"); // ❌ Email does not exist
                } else {
                    resolve("Unknown"); // 🤷‍♂️ Server blocked request
                }
                socket.end();
            }
        });

        socket.on("error", () => resolve("Unknown"));
        socket.on("end", () => resolve("Unknown"));
    });
}

/**
 * HTTP request handler for email validation
 */
app.get("/validate", async (req, res) => {
    const email = decodeURIComponent(req.query.email || '');
    if (!email) {
        return res.status(400).json({
            status: "failed",
            message: "No email address provided",
        });
    }

    const domain = email.includes("@") ? email.split("@")[1] : null;

    const clientDisconnect = new Promise((_, reject) => {
        req.on("close", () => reject("Client disconnected"));
    });

    try {
        const emailStatus = await Promise.race([
            validateEmail(email),
            clientDisconnect,
        ]);

        return res.json({
            status: "success",
            email: email,
            domain: domain,
            result: emailStatus,
        });
    } catch (error) {
        return res.json({
            status: "failed",
            email: email,
            domain: domain,
            result: error === "Client disconnected" ? "Timeout" : "Unknown",
        });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
