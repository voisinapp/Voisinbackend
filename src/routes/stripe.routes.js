import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { stripe } from "../lib/stripe.js";

const router = Router();

router.post("/onboarding-link", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });

  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });
    accountId = account.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.FRONTEND_URL}/compte/paiement?refresh=1`,
    return_url: `${process.env.FRONTEND_URL}/compte/paiement?done=1`,
    type: "account_onboarding",
  });

  res.json({ url: link.url });
});

router.post("/create-payment-intent", requireAuth, async (req, res) => {
  const { dealId } = req.body;

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { provider: true } });
  if (!deal) return res.status(404).json({ error: "Transaction introuvable." });
  if (deal.buyerId !== req.userId) return res.status(403).json({ error: "Non autorisé." });
  if (!deal.provider.stripeOnboarded) {
    return res.status(400).json({ error: "Le prestataire n'a pas terminé la configuration de son compte de paiement." });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(deal.agreedPrice * 100),
    currency: "eur",
    application_fee_amount: Math.round(deal.commissionAmount * 100),
    transfer_data: { destination: deal.provider.stripeAccountId },
    metadata: { dealId: deal.id },
  });

  await prisma.deal.update({ where: { id: deal.id }, data: { stripePaymentIntentId: paymentIntent.id } });

  res.json({ clientSecret: paymentIntent.client_secret });
});

export default router;
