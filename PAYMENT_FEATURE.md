# Payment Integration Feature - Documentation

## 💳 Overview

The Smart Parking System now includes a complete **payment integration system** with:
- **Dynamic pricing** based on parking duration
- **Tiered discounts** for long stays
- **Tax calculation** (10%)
- **Payment processing** (Stripe-style simulation)
- **Payment history** tracking
- Secure card payment flow

## 🎯 Key Features

### 1. Dynamic Pricing
Prices automatically adjust based on how long the car was parked:

**Pricing Tiers:**
- **≤ 1 hour**: Standard rate (minimum 1 hour charge)
- **1-12 hours**: Standard rate
- **12-24 hours**: 10% discount
- **> 24 hours**: 20% discount

### 2. Automatic Price Calculation
- Real-time duration tracking
- Hourly rate from parking area
- Automatic discount application
- Tax calculation (10%)
- Final total computation

### 3. Payment Flow
1. User stops booking (punch out/manual)
2. System calculates duration and price
3. User clicks "Pay Now"
4. Payment modal shows breakdown
5. User enters card details
6. Payment processed
7. Booking marked as paid

### 4. Payment History
- View all past payments
- Total spent summary
- Detailed transaction records
- Searchable/sortable table

## 📊 Pricing Example

### Scenario 1: Short Stay (3 hours)
```
Base Rate: $5/hour
Duration: 3 hours
------------------
Subtotal: $15 (3 × $5)
Discount: $0 (0% - no discount)
Tax: $1.50 (10%)
------------------
TOTAL: $16.50
```

### Scenario 2: Half Day (15 hours)
```
Base Rate: $5/hour
Duration: 15 hours
------------------
Subtotal: $75 (15 × $5)
Discount: -$7.50 (10% long-stay discount)
After Discount: $67.50
Tax: $6.75 (10%)
------------------
TOTAL: $74.25
You saved $7.50!
```

### Scenario 3: Full Day+ (30 hours)
```
Base Rate: $5/hour
Duration: 30 hours
------------------
Subtotal: $150 (30 × $5)
Discount: -$30 (20% extended-stay discount)
After Discount: $120
Tax: $12 (10%)
------------------
TOTAL: $132
You saved $30!
```

## 🔄 Complete Workflow

### User Journey

**1. Park Vehicle**
```
Punch In → Slot Assigned → Parking Active
```

**2. Leave Parking**
```
Punch Out (Camera/Manual) → Duration Calculated → Booking Completed
```

**3. Payment**
```
My Bookings → Pay Now → Enter Card → Payment Processed → Receipt
```

### System Process

**Stop Booking:**
```javascript
// Calculate duration
const startTime = new Date(booking.startTime);
const endTime = new Date();
const durationHours = Math.ceil((endTime - startTime) / (1000 * 60 * 60));

// Apply pricing tier
let multiplier = 1.0;
if (durationHours > 24) multiplier = 0.8;      // 20% off
else if (durationHours > 12) multiplier = 0.9; // 10% off

// Calculate price
const subtotal = durationHours * pricePerHour;
const total = subtotal * multiplier;
const tax = total * 0.1;
const finalTotal = total + tax;
```

**Process Payment:**
```javascript
// Create payment intent
const paymentIntent = await createPaymentIntent(bookingId, amount);

// User enters card details
// Simulate Stripe processing

// Confirm payment
await confirmPayment(paymentIntentId, paymentMethodId);

// Update booking
booking.paymentStatus = 'paid';
booking.paidAmount = amount;
booking.paidAt = new Date();
```

## 💻 API Endpoints

### Calculate Price
```
POST /api/payments/calculate-price
```

**Request:**
```json
{
  "bookingId": "1706702700000"
}
```

**Response:**
```json
{
  "booking": {...},
  "pricing": {
    "durationMinutes": 180,
    "durationHours": 3,
    "basePrice": 5,
    "pricePerHour": 5,
    "subtotal": 15.00,
    "discount": 0.00,
    "discountPercent": 0,
    "tax": 1.50,
    "total": 16.50,
    "currency": "USD"
  }
}
```

### Create Payment Intent
```
POST /api/payments/create-intent
```

**Request:**
```json
{
  "bookingId": "1706702700000",
  "amount": 16.50
}
```

**Response:**
```json
{
  "id": "pi_1234567890",
  "amount": 1650,
  "currency": "usd",
  "status": "requires_payment_method",
  "client_secret": "pi_1234567890_secret_abc123",
  "bookingId": "1706702700000"
}
```

### Confirm Payment
```
POST /api/payments/confirm
```

**Request:**
```json
{
  "paymentIntentId": "pi_1234567890",
  "paymentMethodId": "pm_9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "paymentIntent": {
    "id": "pi_1234567890",
    "status": "succeeded",
    "paid_at": "2026-01-31T15:30:00Z"
  },
  "booking": {
    "id": "1706702700000",
    "paymentStatus": "paid",
    "paidAmount": 16.50,
    "paidAt": "2026-01-31T15:30:00Z"
  }
}
```

### Payment History
```
GET /api/payments/history
```

**Response:**
```json
[
  {
    "id": "pi_1234567890",
    "bookingId": "1706702700000",
    "amount": 16.50,
    "parkingArea": "Downtown Parking",
    "location": "123 Main Street",
    "vehicle": "MH12AB1234",
    "startTime": "2026-01-31T12:00:00Z",
    "endTime": "2026-01-31T15:00:00Z",
    "duration": 3,
    "paidAt": "2026-01-31T15:30:00Z"
  }
]
```

## 🎨 UI Components

### Payment Modal

**Features:**
- Parking summary (location, vehicle, duration)
- Price breakdown (subtotal, discount, tax, total)
- Discount badge (if applicable)
- Card entry form
- Secure payment processing
- Test card notice

**Card Form Fields:**
- Cardholder Name
- Card Number (auto-formatted: 4242 4242 4242 4242)
- Expiry Date (auto-formatted: MM/YY)
- CVV (3 digits)

### Payments View

**Features:**
- Summary cards (total payments, total spent)
- Payment history table
- Sortable columns
- Detailed transaction info
- Payment status badges

## 🧪 Testing

### Test Card Numbers

For testing, use these card numbers:

**Successful Payment:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/28)
CVV: Any 3 digits (e.g., 123)
Name: Any name
```

### Test Scenarios

**Scenario 1: Quick Park (1 hour)**
1. Punch in at 10:00 AM
2. Punch out at 10:30 AM
3. Duration: 1 hour (minimum charge)
4. Expected: $5 + $0.50 tax = $5.50

**Scenario 2: Half Day (14 hours)**
1. Punch in at 8:00 AM
2. Punch out at 10:00 PM
3. Duration: 14 hours
4. Expected: $70 - $7 (10% off) = $63 + $6.30 tax = $69.30

**Scenario 3: Overnight (26 hours)**
1. Punch in Monday 10:00 AM
2. Punch out Tuesday 12:00 PM
3. Duration: 26 hours
4. Expected: $130 - $26 (20% off) = $104 + $10.40 tax = $114.40

## 💰 Revenue for Owners

Owners can track revenue through:
- Owner Bookings page
- Filter by paid status
- Calculate total revenue
- View payment details

**Future Enhancement:**
```javascript
// In Owner Dashboard
const totalRevenue = bookings
  .filter(b => b.paymentStatus === 'paid')
  .reduce((sum, b) => sum + b.paidAmount, 0);
```

## 🔐 Security

### Current Implementation
- Simulated payment processing
- No real card data stored
- Payment intent pattern (Stripe-style)
- Booking-payment linking

### Production Recommendations

**For Real Payment Processing:**

1. **Use Stripe API:**
```bash
npm install stripe
```

2. **Backend Integration:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency: 'usd',
  metadata: { bookingId }
});

// Confirm payment (handle webhook)
app.post('/webhook', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  if (event.type === 'payment_intent.succeeded') {
    // Update booking
  }
});
```

3. **Frontend Integration:**
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');

// Use Stripe Elements for card input
```

4. **Environment Variables:**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 📈 Future Enhancements

**Potential Features:**
1. Multiple payment methods (PayPal, Apple Pay, Google Pay)
2. Subscription plans (monthly parking passes)
3. Refund processing
4. Split payments
5. Loyalty rewards
6. Promotional codes/discounts
7. Invoice generation (PDF)
8. Email receipts
9. SMS payment reminders
10. Auto-payment for frequent users

## 📱 Mobile Payments

For mobile app integration:
- QR code payment
- NFC tap-to-pay
- Mobile wallet integration
- SMS payment links

## 📊 Analytics

Track payment metrics:
- Average transaction value
- Peak payment times
- Payment success rate
- Discount utilization
- Revenue by parking area
- Payment method preferences

## ⚠️ Error Handling

**Payment Failures:**
- Insufficient funds
- Invalid card
- Network timeout
- Server error

**User Experience:**
- Clear error messages
- Retry option
- Alternative payment methods
- Customer support contact

## 📞 Support

For payment issues:
1. Check payment history
2. Verify booking status
3. Contact support with:
   - Booking ID
   - Payment Intent ID
   - Transaction time
   - Error message

---

**Payment System Ready!** 💳
