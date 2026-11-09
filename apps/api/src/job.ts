import { connect, Order, Event, mongoose } from './models.js';
import { reconcile } from './commerce.js';
await connect();
async function tick() {
  const events = await Event.find({ status: 'queued', nextAttempt: { $lte: new Date() } }).limit(
    100,
  );
  for (const e of events) {
    try {
      await reconcile(e.order!);
      e.status = 'done';
    } catch {
      e.attempts++;
      e.nextAttempt = new Date(
        Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7)),
      );
    }
    await e.save();
  }
  const pending = await Order.find({ payment: { $in: ['pending', 'checking'] } })
    .sort({ updatedAt: 1 })
    .limit(100);
  for (const o of pending) {
    try {
      await reconcile(o.gatewayRef);
    } catch {
      console.error('Reconciliation unavailable for', o.number);
    }
  }
  console.log('Reconciliation tick completed', new Date().toISOString());
}
await tick();
if (process.argv.includes('--once')) await mongoose.disconnect();
else setInterval(() => void tick().catch(() => console.error('Reconciliation tick failed')), 60000);
