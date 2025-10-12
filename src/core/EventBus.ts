/**
 * Event Bus - Inter-Module Communication System
 *
 * Allows modules to communicate with each other without direct dependencies.
 * Uses the pub/sub pattern for loose coupling.
 *
 * Usage:
 *
 * // Subscribe to events
 * const unsubscribe = eventBus.on('customer:selected', (data) => {
 *   console.log('Customer selected:', data);
 * });
 *
 * // Emit events
 * eventBus.emit('customer:selected', { id: '123', name: 'John' });
 *
 * // Unsubscribe when done
 * unsubscribe();
 */

export type EventHandler<T = unknown> = (data: T) => void;

export interface EventBusEvents {
  // Customer events
  'customer:selected': { id: string; name: string };
  'customer:updated': { id: string };
  'customer:deleted': { id: string };

  // Transaction events
  'transaction:created': { id: string };
  'transaction:updated': { id: string };
  'transaction:deleted': { id: string };
  'transactions:bulk-updated': { count: number };

  // Invoice events
  'invoice:generated': { customerId: string; invoiceId: string };
  'invoice:sent': { invoiceId: string };

  // Navigation events
  'navigation:changed': { path: string };
  'workspace:changed': { business: string; workspace: string };

  // Generic events
  'data:refresh': { entity: string };
  'notification:show': { message: string; type: 'success' | 'error' | 'info' };
}

class EventBus {
  private events = new Map<keyof EventBusEvents, Set<EventHandler>>();

  /**
   * Subscribe to an event
   * Returns an unsubscribe function
   */
  on<K extends keyof EventBusEvents>(
    event: K,
    handler: EventHandler<EventBusEvents[K]>
  ): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    this.events.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event only once
   */
  once<K extends keyof EventBusEvents>(
    event: K,
    handler: EventHandler<EventBusEvents[K]>
  ): void {
    const wrappedHandler = (data: EventBusEvents[K]) => {
      handler(data);
      this.off(event, wrappedHandler as EventHandler<EventBusEvents[K]>);
    };

    this.on(event, wrappedHandler as EventHandler<EventBusEvents[K]>);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventBusEvents>(
    event: K,
    handler: EventHandler<EventBusEvents[K]>
  ): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);

      // Clean up empty event sets
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<K extends keyof EventBusEvents>(
    event: K,
    data: EventBusEvents[K]
  ): void {
    const handlers = this.events.get(event);

    if (handlers && handlers.size > 0) {
      console.log(`📡 Event emitted: ${String(event)}`, data);

      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    }
  }

  /**
   * Remove all event listeners
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Get all registered events
   */
  getEvents(): string[] {
    return Array.from(this.events.keys()) as string[];
  }

  /**
   * Get number of handlers for an event
   */
  getHandlerCount(event: keyof EventBusEvents): number {
    return this.events.get(event)?.size ?? 0;
  }

  /**
   * Check if event has any handlers
   */
  hasHandlers(event: keyof EventBusEvents): boolean {
    return this.getHandlerCount(event) > 0;
  }

  /**
   * Get statistics about the event bus
   */
  getStats() {
    return {
      totalEvents: this.events.size,
      totalHandlers: Array.from(this.events.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0
      ),
      events: Array.from(this.events.entries()).map(([event, handlers]) => ({
        event,
        handlerCount: handlers.size,
      })),
    };
  }
}

// Singleton instance
export const eventBus = new EventBus();

// React hook for using event bus in components
import { useEffect } from 'react';

export function useEventBus<K extends keyof EventBusEvents>(
  event: K,
  handler: EventHandler<EventBusEvents[K]>,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
