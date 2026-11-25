# Email Verifier (Legacy)

A lightweight Node.js microservice that verifies email deliverability using DNS MX record lookups and SMTP verification.

## Features

- **Syntax validation** via `email-validator`
- **MX record lookup** to check if the domain accepts email
- **Catch-all detection** to identify domains that accept all addresses
- **SMTP RCPT TO verification** to confirm individual mailbox existence

## Prerequisites

- Node.js >= 14.0.0

## Installation

```bash
git clone https://github.com/lukearian2952/email-verifier-legacy.git
cd email-verifier-legacy
npm install
```

## Usage

```bash
npm start
```

The server starts on port `4402` by default.

## API

### `GET /validate?email=<email>`

Verifies the deliverability of an email address.

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `email`   | string | Yes      | The email address to verify |

**Response:**

```json
{
  "status": "success",
  "email": "user@example.com",
  "domain": "example.com",
  "result": "deliverable"
}
```

**Possible `result` values:**

| Result           | Description                                              |
|------------------|----------------------------------------------------------|
| `deliverable`    | The mailbox exists and accepts mail                      |
| `Not Receiving`  | No MX records found, or SMTP rejected the recipient     |
| `Catch-All`      | Domain accepts all addresses; existence is uncertain     |
| `Invalid Syntax` | The email address format is invalid                      |
| `Unknown`        | SMTP server timed out or blocked the verification        |

## Limitations

- SMTP verification connects on ports 25 and 587, which may be blocked by your hosting provider or ISP
- Many mail servers rate-limit or block SMTP verification attempts
- Catch-all domains make individual mailbox verification impossible
- Results are not 100% definitive; some servers return misleading responses

## License

ISC
