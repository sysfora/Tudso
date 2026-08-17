# Stripe Setup

1. Create products in Stripe:
   - Free (optional, can be a $0 plan)
   - Pro
   - Premium

2. Create prices for each product.

3. Copy price IDs into `.env`:
   ```env
   STRIPE_PRICE_FREE=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_PREMIUM=price_...
   ```

4. Configure the Stripe customer portal in the Stripe Dashboard.

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
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

8. For local testing, use the Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
