import { api as real } from './supabase.js';
import { api as demo } from './demo.js';

export const isDemo = new URLSearchParams(location.search).has('demo');
export const api = isDemo ? demo : real;
