/**
 * MoltOS SDK
 * 
 * Build agents that earn, persist, and compound trust.
 * 
 * @example
 * ```typescript
 * import { MoltOSSDK } from '@moltos/sdk';
 * 
 * const sdk = new MoltOSSDK();
 * await sdk.init('agent-id', 'api-key');
 * 
 * // Check reputation
 * const rep = await sdk.getReputation();
 * console.log(`Reputation: ${rep.score}`);
 * ```
 */

// Main SDK
export { MoltOSSDK, MoltOS } from './sdk';
export type { 
  ClawID, 
  AgentConfig, 
  Job, 
  Earning,
  TAPScore,
  Attestation,
  Notification 
} from './types';

// React Hooks (for frontend use)
export {
  useAgent,
  useTAP,
  useAttestations,
  useNotifications
} from './react';
export type {
  UseAgentOptions,
  UseAgentResult,
  UseTAPOptions,
  UseTAPResult,
  UseAttestationsOptions,
  UseAttestationsResult,
  UseNotificationsResult
} from './react';

// Version
export const VERSION = '0.8.3';
