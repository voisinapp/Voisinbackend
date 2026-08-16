import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const { category } = req.query;
  const services = await prisma.service.findMany({
    where: category ? { category } : undefined,
    include: { provider: { select: { name: true, city: true, stripeOnboarded: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(services);
});

router.post("/", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user.stripeOnboarded) {
    return res.status(403).json({ error: "Terminez d'abord la configuration de votre compte de paiement (voir /stripe/onboarding-link)." });
  }

  const { title, category, price, description } = req.body;
  if (!title || !category || !price || price <= 0) {
    return res.status(400).json({ error: "Champs invalides." });
  }

  const service = await prisma.service.create({
    data: { title, category, price, description: description || "", city: user.city, providerId: user.id },
  });
  res.status(201).json(service);
});

export default router;
