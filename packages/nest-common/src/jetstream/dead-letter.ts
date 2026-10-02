/** `dlq.<service>.<durable>` — the subject the `DLQ` stream captures (architecture §2.3). */
export function dlqSubject(service: string, consumer: string): string {
  return `dlq.${service}.${consumer}`;
}
