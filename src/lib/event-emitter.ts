import { EventEmitter as NodeEventEmitter } from 'events'

const emitter = new NodeEventEmitter()

export const EventEmitter = {
  emit(event: string, data: unknown): void {
    emitter.emit(event, data)
  },

  on<T>(event: string, callback: (data: T) => void): void {
    emitter.on(event, callback as (...args: unknown[]) => void)
  },
}
