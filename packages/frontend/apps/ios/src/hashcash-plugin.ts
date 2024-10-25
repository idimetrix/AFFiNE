import { registerPlugin } from '@capacitor/core';

export interface HashcashPlugin {
  hash(options: {
    challenge: string;
    bits?: number;
  }): Promise<{ value: string }>;
}

export const Hashcash = registerPlugin<HashcashPlugin>('Hashcash');
