// src/utils/walletConnector.ts

import { Lucid, WalletApi, Blockfrost } from 'lucid-cardano';

export const supportedWallets = ['nami', 'eternl', 'flint', 'gero'] as const;
export type SupportedWallet = typeof supportedWallets[number];

export const connectWallet = async (walletName: SupportedWallet): Promise<Lucid | null> => {
  if (!supportedWallets.includes(walletName)) {
    throw new Error('Unsupported wallet');
  }

  try {
    const wallet = (window as any).cardano[walletName];
    if (wallet) {
      const api = await wallet.enable();
      const lucid = await Lucid.new(
        new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', 'mainnetuE7K083WTQTQXf6N8OdK9cJmWkxCY2jH'),
        'Mainnet',
      );
      lucid.selectWallet(api);
      return lucid;
    }
  } catch (error) {
    console.error(`Failed to connect ${walletName} wallet:`, error);
    throw error;
  }

  return null;
};

export const disconnectWallet = async (lucid: Lucid): Promise<void> => {
  // Implement wallet disconnection logic here
  // This might vary depending on the wallet and Lucid's API
  // For now, we'll just reset the Lucid instance
  lucid.selectWallet(null as any);
};