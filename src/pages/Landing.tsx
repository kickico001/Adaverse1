import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lucid, Blockfrost } from 'lucid-cardano';
import './Landing.css';

// Define supported wallets
const SUPPORTED_WALLETS = ['nami', 'eternl', 'flint', 'gero', 'yoroi'] as const;
type SupportedWallet = typeof SUPPORTED_WALLETS[number];

const LandingPage: React.FC = () => {
  const [selectedWallet, setSelectedWallet] = useState<SupportedWallet>('nami');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const connectWallet = async (walletName: SupportedWallet) => {
    setIsConnecting(true);
    setError(null);

    try {
      let wallet;
      if (walletName === 'yoroi') {
        wallet = await (window as any).cardano.yoroi.enable();
      } else {
        wallet = (window as any).cardano[walletName];
      }

      if (wallet) {
        const api = walletName === 'yoroi' ? wallet : await wallet.enable();
        const lucid = await Lucid.new(
          new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', 'mainnetuE7K083WTQTQXf6N8OdK9cJmWkxCY2jH'),
          'Mainnet'
        );
        lucid.selectWallet(api);
        
        // Store Lucid instance in localStorage or state management solution
        localStorage.setItem('walletProvider', walletName);
        
        // Redirect to dashboard
        navigate('/dash');
      } else {
        throw new Error(`${walletName} wallet not found. Please install it.`);
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectWallet = () => {
    connectWallet(selectedWallet);
  };

  return (
    <div className="landing-page">
      <header className="header">
        <div className="logo">
          <div className="logo-icon"></div>
          <span className="logo-text">ADAVERSE</span>
        </div>
      </header>
      <main className="main-content">
        <div className="stake-container">
          <h1 className="stake-title">Stake your ADA</h1>
          <p className="wallet-message">Please select your wallet</p>
          <select 
            className="wallet-select"
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value as SupportedWallet)}
          >
            {SUPPORTED_WALLETS.map((wallet) => (
              <option key={wallet} value={wallet}>
                {wallet.charAt(0).toUpperCase() + wallet.slice(1)}
              </option>
            ))}
          </select>
          <button 
            className="connect-button" 
            onClick={handleConnectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect wallet'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </div>
      </main>
      <footer className="footer">
      © 2024 adaversenet.com - All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;