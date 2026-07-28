import crypto from 'crypto';
import webhookRepository from './repository.js';
import rabbitMQManager from '../../config/rabbitmq.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class WebhookService {
  constructor() {
    // Delays for exponential backoff retries: 5s, 15s, 45s, 2m, 5m
    this.retryDelays = [5000, 15000, 45000, 120000, 300000];
  }

  // --- Endpoint Management ---
  async createEndpoint(merchantId, { url, events }) {
    if (!url || !url.startsWith('http')) {
      throw new AppError('VALIDATION_ERROR', 'A valid HTTP or HTTPS webhook destination URL is required', 400);
    }
    if (!Array.isArray(events) || events.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one event subscription type is required', 400);
    }

    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    return webhookRepository.createEndpoint({ merchantId, url, secret, events });
  }

  async getEndpoints(merchantId) {
    return webhookRepository.findEndpointsByMerchant(merchantId);
  }

  async updateEndpoint(merchantId, endpointId, { url, status, events }) {
    const endpoint = await webhookRepository.findEndpointById(endpointId);
    if (!endpoint || endpoint.merchant_id !== merchantId) {
      throw new AppError('NOT_FOUND', 'Webhook endpoint not found', 404);
    }

    return webhookRepository.updateEndpoint(endpointId, {
      url: url || endpoint.url,
      status: status || endpoint.status,
      events: events || endpoint.events
    });
  }

  async deleteEndpoint(merchantId, endpointId) {
    const endpoint = await webhookRepository.findEndpointById(endpointId);
    if (!endpoint || endpoint.merchant_id !== merchantId) {
      throw new AppError('NOT_FOUND', 'Webhook endpoint not found', 404);
    }
    return webhookRepository.deleteEndpoint(endpointId);
  }

  async rotateSecret(merchantId, endpointId) {
    const endpoint = await webhookRepository.findEndpointById(endpointId);
    if (!endpoint || endpoint.merchant_id !== merchantId) {
      throw new AppError('NOT_FOUND', 'Webhook endpoint not found', 404);
    }
    const newSecret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    return webhookRepository.updateSecret(endpointId, newSecret);
  }

  // --- Event Publishing and Queuing ---
  async triggerWebhook(merchantId, eventType, payload) {
    const eventId = `evt_${crypto.randomUUID()}`;
    
    // Save to database
    const event = await webhookRepository.createWebhookEvent({
      id: eventId,
      merchantId,
      eventType,
      payload
    });

    // Publish to delivery queue
    await rabbitMQManager.publishToQueue('webhooks-delivery', { eventId });
    return event;
  }

  // --- Consumer Queue Dispatcher ---
  async initializeWebhookWorker() {
    await rabbitMQManager.consumeQueue('webhooks-delivery', async (msg, channel) => {
      try {
        const { eventId } = JSON.parse(msg.content.toString());
        await this.deliverEvent(eventId);
        channel.ack();
      } catch (err) {
        logger.error('Failed to process webhook delivery queue job:', err);
        // Do not nack with requeue to avoid infinite loop; retries are handled within the delivery logic
        channel.ack();
      }
    });
  }

  async deliverEvent(eventId) {
    const event = await webhookRepository.findWebhookEventById(eventId);
    if (!event) {
      logger.error(`Webhook event ID ${eventId} could not be resolved from DB`);
      return;
    }

    // Find active subscribers
    const activeEndpoints = await webhookRepository.findActiveEndpointsByMerchantAndEvent(event.merchant_id, event.event_type);
    
    if (activeEndpoints.length === 0) {
      // No active webhook subscriptions; close as success
      await webhookRepository.updateWebhookEventStatus(eventId, 'SUCCESS');
      return;
    }

    // Asynchronously dispatch to all subscribers
    const deliveryPromises = activeEndpoints.map((endpoint) => 
      this.deliverToEndpoint(event, endpoint, 1)
    );
    
    await Promise.all(deliveryPromises);
  }

  async deliverToEndpoint(event, endpoint, attemptNumber) {
    const payloadStr = JSON.stringify({
      id: event.id,
      event: event.event_type,
      data: event.payload,
      created_at: event.created_at
    });

    // HMAC signature signing
    const signature = crypto.createHmac('sha256', endpoint.secret).update(payloadStr).digest('hex');
    const deliveryId = `del_${crypto.randomUUID()}`;

    let responseStatus = null;
    let responseBody = '';
    let success = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout threshold

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fincore-signature': signature,
          'x-fincore-event-id': event.id,
          'User-Agent': 'FinCore-Webhook-Dispatcher/1.0'
        },
        body: payloadStr,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      responseStatus = response.status;
      responseBody = await response.text();

      // Only 2xx statuses represent delivery success
      if (response.ok) {
        success = true;
      }
    } catch (err) {
      responseBody = err.name === 'AbortError' ? 'TIMEOUT_ERROR' : `NETWORK_ERROR: ${err.message}`;
    }

    // Log the delivery attempt in postgres
    await webhookRepository.createWebhookDelivery({
      id: deliveryId,
      eventId: event.id,
      endpointId: endpoint.id,
      responseStatus,
      responseBody: responseBody.slice(0, 1000), // cap logs
      attemptNumber,
      status: success ? 'SUCCESS' : 'FAILED'
    });

    if (success) {
      await webhookRepository.updateWebhookEventStatus(event.id, 'SUCCESS');
      logger.info(`Webhook successfully delivered for event ${event.id} to ${endpoint.url}`);
    } else {
      logger.warn(`Webhook delivery attempt ${attemptNumber} failed for event ${event.id} to ${endpoint.url}`);

      // Handle retry scheduling if under retry count threshold
      const maxRetries = 5;
      if (attemptNumber < maxRetries) {
        const delay = this.retryDelays[attemptNumber - 1] || 10000;
        logger.info(`Scheduling retry attempt ${attemptNumber + 1} in ${delay}ms for event ${event.id}`);
        
        setTimeout(() => {
          this.deliverToEndpoint(event, endpoint, attemptNumber + 1);
        }, delay);
      } else {
        await webhookRepository.updateWebhookEventStatus(event.id, 'FAILED');
        logger.error(`Webhook delivery exhausted max attempts. Event ${event.id} marked as FAILED`);
      }
    }
  }

  // --- Manual Retry Intervention ---
  async retryWebhookDelivery(merchantId, deliveryId) {
    // Find delivery
    const query = `
      SELECT d.*, e.merchant_id 
      FROM webhook_deliveries d
      JOIN webhook_events e ON d.webhook_event_id = e.id
      WHERE d.id = $1
    `;
    const { rows } = await pool.query(query, [deliveryId]);
    const delivery = rows[0];

    if (!delivery || delivery.merchant_id !== merchantId) {
      throw new AppError('NOT_FOUND', 'Webhook delivery history record not found', 404);
    }

    const event = await webhookRepository.findWebhookEventById(delivery.webhook_event_id);
    const endpoint = await webhookRepository.findEndpointById(delivery.webhook_endpoint_id);

    if (!event || !endpoint) {
      throw new AppError('NOT_FOUND', 'Original event or endpoint details have been deleted', 404);
    }

    // Trigger immediate delivery attempt (as attempt number 1)
    // Run asynchronously to allow instant UI response
    this.deliverToEndpoint(event, endpoint, 1);
    return { success: true, message: 'Retry attempt scheduled' };
  }

  async getDeliveries(merchantId) {
    return webhookRepository.getDeliveriesByMerchant(merchantId);
  }

  async getAllDeliveries() {
    return webhookRepository.getAllDeliveries();
  }
}

const webhookService = new WebhookService();
export default webhookService;
