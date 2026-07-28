import pool from '../../config/db.js';

export class WebhookRepository {
  // --- Endpoint Management ---
  async createEndpoint({ merchantId, url, secret, events }) {
    const query = `
      INSERT INTO webhook_endpoints (merchant_id, url, secret, events)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [merchantId, url, secret, JSON.stringify(events)]);
    return rows[0];
  }

  async findEndpointById(id) {
    const query = `SELECT * FROM webhook_endpoints WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  async findEndpointsByMerchant(merchantId) {
    const query = `SELECT * FROM webhook_endpoints WHERE merchant_id = $1 ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, [merchantId]);
    return rows;
  }

  async findActiveEndpointsByMerchantAndEvent(merchantId, eventType) {
    const query = `
      SELECT * FROM webhook_endpoints 
      WHERE merchant_id = $1 
        AND status = 'ACTIVE' 
        AND events @> $2::jsonb
    `;
    const { rows } = await pool.query(query, [merchantId, JSON.stringify([eventType])]);
    return rows;
  }

  async updateEndpoint(id, { url, status, events }) {
    const query = `
      UPDATE webhook_endpoints
      SET url = $1, status = $2, events = $3::jsonb, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [url, status, JSON.stringify(events), id]);
    return rows[0];
  }

  async deleteEndpoint(id) {
    const query = `DELETE FROM webhook_endpoints WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  async updateSecret(id, newSecret) {
    const query = `
      UPDATE webhook_endpoints
      SET secret = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [newSecret, id]);
    return rows[0];
  }

  // --- Webhook Events ---
  async createWebhookEvent({ id, merchantId, eventType, payload, status = 'PENDING' }) {
    const query = `
      INSERT INTO webhook_events (id, merchant_id, event_type, payload, status)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [id, merchantId, eventType, JSON.stringify(payload), status]);
    return rows[0];
  }

  async findWebhookEventById(id) {
    const query = `SELECT * FROM webhook_events WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  async updateWebhookEventStatus(id, status) {
    const query = `UPDATE webhook_events SET status = $1 WHERE id = $2 RETURNING *`;
    const { rows } = await pool.query(query, [status, id]);
    return rows[0];
  }

  // --- Webhook Deliveries (Attempt Logs) ---
  async createWebhookDelivery({ id, eventId, endpointId, responseStatus, responseBody, attemptNumber, status }) {
    const query = `
      INSERT INTO webhook_deliveries (id, webhook_event_id, webhook_endpoint_id, response_status, response_body, attempt_number, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [id, eventId, endpointId, responseStatus, responseBody, attemptNumber, status]);
    return rows[0];
  }

  async getDeliveriesByMerchant(merchantId) {
    const query = `
      SELECT d.*, e.event_type, e.payload, p.url
      FROM webhook_deliveries d
      JOIN webhook_events e ON d.webhook_event_id = e.id
      JOIN webhook_endpoints p ON d.webhook_endpoint_id = p.id
      WHERE e.merchant_id = $1
      ORDER BY d.created_at DESC
    `;
    const { rows } = await pool.query(query, [merchantId]);
    return rows;
  }

  async getAllDeliveries() {
    const query = `
      SELECT d.*, e.event_type, e.payload, p.url, u.email as merchant_email
      FROM webhook_deliveries d
      JOIN webhook_events e ON d.webhook_event_id = e.id
      JOIN webhook_endpoints p ON d.webhook_endpoint_id = p.id
      JOIN users u ON e.merchant_id = u.id
      ORDER BY d.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }
}

const webhookRepository = new WebhookRepository();
export default webhookRepository;
