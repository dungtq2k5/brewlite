import { AckPolicy, connect, DeliverPolicy, type JetStreamManager } from 'nats';
import { dlqSubject } from '@brewlite/nest-common';
import { newId } from '@brewlite/contracts';

const DURABLE = 'catalog-ordering-order-status_changed';
const DLQ_SUBJECT = dlqSubject('catalog', DURABLE);

/**
 * `pnpm replay:last-status-changed` (check 4) — reads the **last** message on `ORDERING`,
 * republishes its exact payload under a new `Nats-Msg-Id`, and prints the DLQ count before
 * and after. A consumer that absorbs a genuine duplicate (a new header, the same body)
 * leaves the count unchanged; a growing count means the replay was rejected, not absorbed.
 */
async function main(): Promise<void> {
  const url = process.env.NATS_URL ?? 'nats://localhost:24222';
  const nc = await connect({ servers: url });
  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  const last = await jsm.streams.getMessage('ORDERING', {
    seq: 0,
    last_by_subj: 'ordering.order.status_changed',
  });
  const data = last.data;

  const dlqBefore = await countMessages(jsm, DLQ_SUBJECT);
  console.log('DLQ count before:', dlqBefore);

  await js.publish('ordering.order.status_changed', data, { msgID: newId() });
  console.log('replayed under a new Nats-Msg-Id, waiting for the consumer to ack...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const dlqAfter = await countMessages(jsm, DLQ_SUBJECT);
  console.log('DLQ count after:', dlqAfter);
  console.log(dlqAfter === dlqBefore ? 'PASS — absorbed, not dead-lettered' : 'FAIL — DLQ grew');

  await nc.close();
}

async function countMessages(jsm: JetStreamManager, subject: string): Promise<number> {
  const consumerName = `count-${newId()}`;
  await jsm.consumers.add('DLQ', {
    durable_name: consumerName,
    ack_policy: AckPolicy.None,
    filter_subject: subject,
    deliver_policy: DeliverPolicy.All,
  });
  const info = await jsm.consumers.info('DLQ', consumerName);
  await jsm.consumers.delete('DLQ', consumerName);
  return info.num_pending;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
