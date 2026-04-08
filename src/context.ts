import { createContext } from '@lit/context';
import type { NascachtConfig } from './types.js';

export const nascachtConfigContext = createContext<NascachtConfig>(
  Symbol('nascacht-config')
);
