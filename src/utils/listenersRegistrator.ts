// Registers every module's event receivers at process startup, before the
// server starts accepting operations. See
// docs/architecture/10-cross-module-communication.md — a receiver that
// exists but isn't `.subscribe()`-d here is dead code that passes its own
// unit test while doing nothing in the running app.
//
// Example once a receiver exists:
//   import { UserCreatedReceiver } from '@/modules/shared'
//   export const listenersRegistrator = (): void => {
//     UserCreatedReceiver.subscribe()
//   }

export const listenersRegistrator = (): void => {
  // No receivers registered yet.
}
