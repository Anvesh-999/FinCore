# Webhook Delivery Engine

FinCore implements a reliable, event-driven webhook dispatch system backed by a message queue.

## Delivery Pipeline

```
Event Triggered (e.g. Succeeded Payment)
        ↓
Create Signed Payload (HMAC SHA-256)
        ↓
Publish message to RabbitMQ Queue
        ↓
Webhook Worker consumes message
        ↓
POST request to Merchant Endpoint
```

### 1. Cryptographic Signatures
To allow merchants to verify that the webhook payload originated from FinCore, all delivery headers include:

```
X-FinCore-Signature: t=<timestamp>,v1=<hmac-sha256-signature>
```

The signature is computed using a secret key assigned to the webhook configuration endpoint.

### 2. Exponential Backoff & Retries
If the merchant server is down or returns a non-2xx response:
* The worker schedules a retry with exponential backoff (e.g., $t \times 2^{\text{attempt}}$ seconds).
* Up to 5 delivery attempts are recorded with HTTP statuses, response sizes, durations, and timestamps.
* After maximum retries, the message enters a `DEAD` state.
* The merchant can manually re-trigger failed dispatches via the Webhooks Console.
