package org.openemr2026.outbox;

/**
 * A same-database consumer. Implementations must keep their effect inside the
 * caller transaction and must not perform a remote side effect directly.
 */
public interface OutboxConsumer {

    String consumerName();

    void consume(OutboxMessage message);
}
