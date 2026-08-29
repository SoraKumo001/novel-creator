/** 伏線の進行状態（unresolved=未回収, resolved=回収済み, abandoned=断念） */
export const foreshadowingStatuses = ['unresolved', 'resolved', 'abandoned'] as const;
export type ForeshadowingStatusValue = (typeof foreshadowingStatuses)[number];
