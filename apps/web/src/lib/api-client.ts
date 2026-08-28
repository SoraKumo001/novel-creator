import { hc } from 'hono/client';
import type { ApiType } from '@novel-creator/api';

const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

export const apiClient = hc<ApiType>(`${baseUrl}/api`);
