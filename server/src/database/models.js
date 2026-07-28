import mongoose from 'mongoose';

const { Schema } = mongoose;

// 1. User Schema
const UserSchema = new Schema({
  _id: { type: Number, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['CUSTOMER', 'MERCHANT', 'ADMIN', 'AUDITOR'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 2. Wallet Schema
const WalletSchema = new Schema({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true, index: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'FROZEN', 'CLOSED'] },
  availableBalance: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 3. Ledger Account Schema
const LedgerAccountSchema = new Schema({
  _id: { type: Number, required: true },
  holderType: { type: String, required: true, enum: ['CUSTOMER', 'MERCHANT', 'SYSTEM'] },
  holderId: { type: Number, default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

// 4. Ledger Transaction Schema
const LedgerTransactionSchema = new Schema({
  _id: { type: String, required: true },
  referenceType: { type: String, required: true, enum: ['TRANSFER', 'PAYMENT', 'REFUND', 'ONBOARDING_GRANT'] },
  referenceId: { type: String, required: true },
  status: { type: String, default: 'POSTED' },
  createdAt: { type: Date, default: Date.now }
});

// 5. Ledger Entry Schema
const LedgerEntrySchema = new Schema({
  ledgerTransactionId: { type: String, ref: 'LedgerTransaction', required: true, index: true },
  ledgerAccountId: { type: Number, ref: 'LedgerAccount', required: true, index: true },
  direction: { type: String, required: true, enum: ['DEBIT', 'CREDIT'] },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  createdAt: { type: Date, default: Date.now }
});

// 6. Transfer Schema
const TransferSchema = new Schema({
  _id: { type: String, required: true },
  senderWalletId: { type: Number, required: true },
  recipientWalletId: { type: Number, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'CREATED', enum: ['CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'] },
  idempotencyKey: { type: String, index: true, unique: true, sparse: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 7. Merchant Schema
const MerchantSchema = new Schema({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true, unique: true, index: true },
  businessName: { type: String, required: true },
  businessType: { type: String },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'SUSPENDED'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 8. Merchant API Key Schema
const MerchantApiKeySchema = new Schema({
  _id: { type: Number, required: true },
  merchantId: { type: Number, required: true, index: true },
  publicKey: { type: String, required: true, unique: true, index: true },
  secretKeyHash: { type: String, required: true },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'REVOKED'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 9. Payment Schema
const PaymentSchema = new Schema({
  _id: { type: String, required: true },
  merchantId: { type: Number, required: true, index: true },
  customerWalletId: { type: Number, default: null },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'CREATED', enum: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
  idempotencyKey: { type: String, index: true },
  reference: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 10. Refund Schema
const RefundSchema = new Schema({
  _id: { type: String, required: true },
  paymentId: { type: String, ref: 'Payment', required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'CREATED', enum: ['CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED'] },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 11. Webhook Endpoint Schema
const WebhookEndpointSchema = new Schema({
  _id: { type: Number, required: true },
  merchantId: { type: Number, required: true, index: true },
  url: { type: String, required: true },
  secret: { type: String, required: true },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] },
  events: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
// 12. Webhook Delivery Schema
const WebhookDeliverySchema = new Schema({
  _id: { type: String, required: true },
  merchantId: { type: Number, required: true, index: true },
  eventId: { type: String, required: true },
  endpointId: { type: Number, required: true },
  responseStatus: { type: Number },
  responseBody: { type: String },
  attemptNumber: { type: Number },
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
  createdAt: { type: Date, default: Date.now }
});// 16. Webhook Event Schema
const WebhookEventSchema = new Schema({
  _id: { type: String, required: true },
  merchantId: { type: Number, required: true, index: true },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
  createdAt: { type: Date, default: Date.now }
});


// 13. Idempotency Record Schema
const IdempotencyRecordSchema = new Schema({
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  requestHash: { type: String },
  responseStatus: { type: Number },
  responseBody: { type: Schema.Types.Mixed },
  status: { type: String, default: 'PROCESSING', enum: ['PROCESSING', 'COMPLETED', 'FAILED'] },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

// 14. Reconciliation Run Schema
const ReconciliationRunSchema = new Schema({
  runDate: { type: Date, default: Date.now },
  status: { type: String, default: 'COMPLETED', enum: ['COMPLETED', 'FAILED'] },
  totalPaymentsChecked: { type: Number, default: 0 },
  totalRefundsChecked: { type: Number, default: 0 },
  totalTransfersChecked: { type: Number, default: 0 },
  inconsistenciesFound: { type: Number, default: 0 },
  results: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

// 15. Risk Assessment Schema
const RiskAssessmentSchema = new Schema({
  transactionId: { type: String, required: true, index: true },
  transactionType: { type: String, required: true },
  riskScore: { type: Number, required: true },
  rulesTriggered: { type: [String], default: [] },
  decision: { type: String, required: true, enum: ['ALLOW', 'FLAG', 'VETO'] },
  createdAt: { type: Date, default: Date.now }
});

// Counter Schema
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

CounterSchema.statics.getNextSequence = async function(name) {
  const ret = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return ret.seq;
};

export const User = mongoose.model('User', UserSchema);
export const Wallet = mongoose.model('Wallet', WalletSchema);
export const LedgerAccount = mongoose.model('LedgerAccount', LedgerAccountSchema);
export const LedgerTransaction = mongoose.model('LedgerTransaction', LedgerTransactionSchema);
export const LedgerEntry = mongoose.model('LedgerEntry', LedgerEntrySchema);
export const Transfer = mongoose.model('Transfer', TransferSchema);
export const Merchant = mongoose.model('Merchant', MerchantSchema);
export const MerchantApiKey = mongoose.model('MerchantApiKey', MerchantApiKeySchema);
export const Payment = mongoose.model('Payment', PaymentSchema);
export const Refund = mongoose.model('Refund', RefundSchema);
export const WebhookEndpoint = mongoose.model('WebhookEndpoint', WebhookEndpointSchema);
export const WebhookDelivery = mongoose.model('WebhookDelivery', WebhookDeliverySchema);
export const WebhookEvent = mongoose.model('WebhookEvent', WebhookEventSchema);
export const IdempotencyRecord = mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
export const ReconciliationRun = mongoose.model('ReconciliationRun', ReconciliationRunSchema);
export const RiskAssessment = mongoose.model('RiskAssessment', RiskAssessmentSchema);
export const Counter = mongoose.model('Counter', CounterSchema);

export default {
  User,
  Wallet,
  LedgerAccount,
  LedgerTransaction,
  LedgerEntry,
  Transfer,
  Merchant,
  MerchantApiKey,
  Payment,
  Refund,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEvent,
  IdempotencyRecord,
  ReconciliationRun,
  RiskAssessment,
  Counter
};
