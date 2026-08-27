# Stripe Setup

1. Create products in Stripe:

   One-time
   - Basic — $59.00 one time
   - Plus — $118.00 one time
   - Pro — $177.00 one time

   Subscriptions
   - Weekly — $78.00 / week
   - Monthly — $149.90 / month
   - Yearly — $599.90 / year

2. Create a price for each product. One-time products must use a **one-time** price, not recurring.

3. Copy price IDs into `.env`:
   ```env
   STRIPE_PRICE_BASIC=price_...
   STRIPE_PRICE_PLUS=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_WEEKLY=price_...
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_YEARLY=price_...
   ```

4. Configure the Stripe customer portal in the Stripe Dashboard (for weekly/monthly/yearly changes and cancellation).

5. Add a webhook endpoint pointing to:
   ```
   https://your-server/webhooks/stripe
   ```

6. Select these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

7. Copy the webhook signing secret to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

8. For local testing, use the Stripe CLI to forward webhooks:
   ```
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
