import express from 'express';
import cors from 'cors';
import { Bot, webhookCallback } from 'grammy';

// ─── Environment ─────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT ?? 3000;

if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN environment variable is required.');
  process.exit(1);
}

// ─── Products catalogue ───────────────────────────────────────────────────────

const PRODUCTS = {
  hints_3: {
    title: '3 Hints',
    description: 'Get 3 hints to use in GridSum Daily puzzles.',
    stars: 30,
  },
  hints_5: {
    title: '5 Hints',
    description: 'Get 5 hints to use in GridSum Daily puzzles.',
    stars: 50,
  },
  streak_restore: {
    title: 'Restore Streak',
    description: 'Restore your GridSum Daily streak and keep your progress alive.',
    stars: 50,
  },
};

// ─── Bot setup ────────────────────────────────────────────────────────────────

const bot = new Bot(BOT_TOKEN);

// Must answer pre_checkout_query within 10 seconds — always approve.
bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
    console.log(`[pre_checkout_query] approved for user ${ctx.from.id}`);
  } catch (err) {
    console.error('[pre_checkout_query] failed to answer:', err);
  }
});

// Successful payment handler — notify user and log details.
bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  let productTitle = 'purchase';

  try {
    const payload = JSON.parse(payment.invoice_payload);
    const product = PRODUCTS[payload.product];
    if (product) {
      productTitle = product.title;
    }
    console.log(
      `[successful_payment] user=${ctx.from.id} product=${payload.product} ` +
        `stars=${payment.total_amount} charge_id=${payment.telegram_payment_charge_id}`
    );
  } catch (err) {
    console.error('[successful_payment] failed to parse payload:', err);
  }

  try {
    await ctx.reply(
      `✅ Your ${productTitle} have been added! Go back to GridSum and enjoy.`
    );
  } catch (err) {
    console.error('[successful_payment] failed to send reply:', err);
  }
});

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(
  cors({
    origin: ['https://gridsum-daily.vercel.app', 'http://localhost:3456'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// Create invoice link for Telegram Stars payment
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { product: productKey } = req.body;

    const product = PRODUCTS[productKey];
    if (!product) {
      return res.status(400).json({ error: `Unknown product: ${productKey}` });
    }

    const payload = JSON.stringify({ product: productKey, ts: Date.now() });

    const link = await bot.api.createInvoiceLink(
      product.title,
      product.description,
      payload,
      '', // provider_token — empty string for Telegram Stars (XTR)
      'XTR',
      [{ label: product.title, amount: product.stars }]
    );

    console.log(`[create-invoice] product=${productKey} stars=${product.stars}`);
    return res.json({ link });
  } catch (err) {
    console.error('[create-invoice] error:', err);
    return res.status(500).json({ error: 'Failed to create invoice link.' });
  }
});

// ─── Webhook or polling ───────────────────────────────────────────────────────

if (WEBHOOK_URL) {
  // Production: webhook mode
  app.use('/telegram-webhook', webhookCallback(bot, 'express'));

  app.listen(PORT, async () => {
    console.log(`[server] listening on port ${PORT} (webhook mode)`);
    try {
      await bot.api.setWebhook(`${WEBHOOK_URL}/telegram-webhook`);
      console.log(`[bot] webhook set → ${WEBHOOK_URL}/telegram-webhook`);
    } catch (err) {
      console.error('[bot] failed to set webhook:', err);
    }
  });
} else {
  // Local dev: long-polling mode
  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT} (polling mode)`);
  });

  bot.start({
    onStart: () => console.log('[bot] polling started'),
  });
}
