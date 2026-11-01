import { Prisma } from "@dynapos/db";

export interface EnqueueOutboxParams {
  businessId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

/**
 * Enqueues an event into the transactional outbox table within the enclosing transaction.
 * Guarantees that the event is committed if and only if the business transaction commits.
 */
export async function enqueueOutboxEvent(
  tx: Prisma.TransactionClient,
  params: EnqueueOutboxParams
) {
  return await tx.outboxEvent.create({
    data: {
      businessId: params.businessId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload as any,
      headers: (params.headers || {}) as any,
      status: "PENDING",
      retryCount: 0,
    },
  });
}

