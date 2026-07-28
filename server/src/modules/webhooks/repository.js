import { WebhookEndpoint, WebhookEvent, WebhookDelivery, Counter, User } from '../../database/models.js';

export class WebhookRepository {
  formatEndpoint(e) {
    if (!e) return null;
    return {
      id: e._id,
      merchant_id: e.merchantId,
      url: e.url,
      secret: e.secret,
      status: e.status,
      events: e.events || [],
      created_at: e.createdAt,
      updated_at: e.updatedAt
    };
  }

  formatEvent(ev) {
    if (!ev) return null;
    return {
      id: ev._id,
      merchant_id: ev.merchantId,
      event_type: ev.eventType,
      payload: ev.payload || {},
      status: ev.status,
      created_at: ev.createdAt
    };
  }

  formatDelivery(d) {
    if (!d) return null;
    return {
      id: d._id,
      merchant_id: d.merchantId,
      webhook_event_id: d.eventId,
      webhook_endpoint_id: d.endpointId,
      response_status: d.responseStatus,
      response_body: d.responseBody,
      attempt_number: d.attemptNumber,
      status: d.status,
      created_at: d.createdAt
    };
  }

  // --- Endpoint Management ---
  async createEndpoint({ merchantId, url, secret, events }, session) {
    const nextId = await Counter.getNextSequence('webhook_endpoints');
    const endpoint = await WebhookEndpoint.create(
      [{
        _id: nextId,
        merchantId: Number(merchantId),
        url,
        secret,
        events
      }],
      { session }
    );
    return this.formatEndpoint(endpoint[0].toObject());
  }

  async findEndpointById(id) {
    const endpoint = await WebhookEndpoint.findById(id).lean();
    return this.formatEndpoint(endpoint);
  }

  async findEndpointsByMerchant(merchantId) {
    const list = await WebhookEndpoint.find({ merchantId: Number(merchantId) }).sort({ createdAt: -1 }).lean();
    return list.map(e => this.formatEndpoint(e));
  }

  async findActiveEndpointsByMerchantAndEvent(merchantId, eventType) {
    const list = await WebhookEndpoint.find({
      merchantId: Number(merchantId),
      status: 'ACTIVE',
      events: eventType
    }).lean();
    return list.map(e => this.formatEndpoint(e));
  }

  async updateEndpoint(id, { url, status, events }) {
    const endpoint = await WebhookEndpoint.findByIdAndUpdate(
      id,
      { $set: { url, status, events, updatedAt: new Date() } },
      { new: true }
    );
    return this.formatEndpoint(endpoint ? endpoint.toObject() : null);
  }

  async deleteEndpoint(id) {
    const endpoint = await WebhookEndpoint.findByIdAndDelete(id);
    return this.formatEndpoint(endpoint ? endpoint.toObject() : null);
  }

  async updateSecret(id, newSecret) {
    const endpoint = await WebhookEndpoint.findByIdAndUpdate(
      id,
      { $set: { secret: newSecret, updatedAt: new Date() } },
      { new: true }
    );
    return this.formatEndpoint(endpoint ? endpoint.toObject() : null);
  }

  // --- Webhook Events ---
  async createWebhookEvent({ id, merchantId, eventType, payload, status = 'PENDING' }) {
    const event = await WebhookEvent.create({
      _id: id,
      merchantId: Number(merchantId),
      eventType,
      payload,
      status
    });
    return this.formatEvent(event.toObject());
  }

  async findWebhookEventById(id) {
    const event = await WebhookEvent.findById(id).lean();
    return this.formatEvent(event);
  }

  async updateWebhookEventStatus(id, status) {
    const event = await WebhookEvent.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    return this.formatEvent(event ? event.toObject() : null);
  }

  // --- Webhook Deliveries (Attempt Logs) ---
  async createWebhookDelivery({ id, eventId, endpointId, responseStatus, responseBody, attemptNumber, status }) {
    const event = await WebhookEvent.findById(eventId).lean();
    
    const delivery = await WebhookDelivery.create({
      _id: id,
      merchantId: event ? event.merchantId : 0,
      eventId,
      endpointId: Number(endpointId),
      responseStatus,
      responseBody,
      attemptNumber,
      status
    });
    return this.formatDelivery(delivery.toObject());
  }

  async getDeliveriesByMerchant(merchantId) {
    const deliveries = await WebhookDelivery.find({ merchantId: Number(merchantId) }).sort({ createdAt: -1 }).lean();
    const result = [];
    for (const d of deliveries) {
      const event = await WebhookEvent.findById(d.eventId).lean();
      const endpoint = await WebhookEndpoint.findById(d.endpointId).lean();
      result.push({
        ...this.formatDelivery(d),
        event_type: event ? event.eventType : 'unknown',
        payload: event ? event.payload : {},
        url: endpoint ? endpoint.url : 'unknown'
      });
    }
    return result;
  }

  async getAllDeliveries() {
    const deliveries = await WebhookDelivery.find().sort({ createdAt: -1 }).lean();
    const result = [];
    for (const d of deliveries) {
      const event = await WebhookEvent.findById(d.eventId).lean();
      const endpoint = await WebhookEndpoint.findById(d.endpointId).lean();
      let merchantEmail = 'unknown';
      if (event) {
        const user = await User.findById(event.merchantId).lean();
        if (user) {
          merchantEmail = user.email;
        }
      }
      result.push({
        ...this.formatDelivery(d),
        event_type: event ? event.eventType : 'unknown',
        payload: event ? event.payload : {},
        url: endpoint ? endpoint.url : 'unknown',
        merchant_email: merchantEmail
      });
    }
    return result;
  }
}

const webhookRepository = new WebhookRepository();
export default webhookRepository;
