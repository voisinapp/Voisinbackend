import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { COMMISSION_RATE } from "../lib/stripe.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { serviceId, agreedPrice } = req.body;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return res.status(404).json({ error: "Annonce introuvable." });
  if (service.providerId === req.userId) {
    return res.status(400).json({ error: "Vous ne pouvez pas acheter votre propre service." });
  }

  const commissionAmount = Math.round(agreedPrice * COMMISSION_RATE * 100) / 100;
  const providerAmount = Math.round((agreedPrice - commissionAmount) * 100) / 100;

  const deal = await prisma.deal.create({
    data: {
      serviceId,
      agreedPrice,
      commissionAmount,
      providerAmount,
      buyerId: req.userId,
      providerId: service.providerId,
    },
  });

  res.status(201).json(deal);
});

router.get("/:id", requireAuth, async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id },
    include: { service: true, buyer: { select: { name: true } }, provider: { select: { name: true } } },
  });
  if (!deal) return res.status(404).json({ error: "Introuvable." });
  res.json(deal);
});

export default router;
