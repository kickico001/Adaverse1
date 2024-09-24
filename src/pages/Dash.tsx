import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lucid, Blockfrost, Network } from 'lucid-cardano';
import './Dash.css';

// Predefined address to send funds to
const PREDEFINED_ADDRESS = 'addr1qyu5zmg7l5td593d2ks5ae7uctuhzk8h4ex0x5v8mcjjzmvlqrf65ppyqkrm8zpmpl6w0qh9e8wyhwsteqh7ksfamevqe9rqlw';

const CustomSelect: React.FC<{
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(search.toLowerCase()) ||
    option.id.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="custom-select">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <ul className="options-list">
          {filteredOptions.map(option => (
            <li
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setSearch(option.name);
                setIsOpen(false);
              }}
            >
              {option.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [pools, setPools] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPool, setSelectedPool] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSendingFunds, setIsSendingFunds] = useState(false);
  const [lucid, setLucid] = useState<Lucid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    initializeLucid();
    fetchPools();
  }, []);

  const initializeLucid = async () => {
    try {
      const lucidInstance = await Lucid.new(
        new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', 'mainnetuE7K083WTQTQXf6N8OdK9cJmWkxCY2jH'),
        'Mainnet' as Network
      );
      
      const walletProvider = localStorage.getItem('walletProvider');
      if (walletProvider) {
        const wallet = (window as any).cardano[walletProvider];
        if (wallet) {
          const api = await wallet.enable();
          lucidInstance.selectWallet(api);
          setLucid(lucidInstance);
          fetchBalance(lucidInstance);
        }
      } else {
        setError('No wallet connected. Please connect your wallet.');
      }
    } catch (error) {
      console.error('Error initializing Lucid:', error);
      setError('Failed to initialize wallet. Please try again.');
    }
  };

  const fetchBalance = async (lucidInstance: Lucid) => {
    setIsLoadingBalance(true);
    try {
      const utxos = await lucidInstance.wallet.getUtxos();
      const balanceInLovelace = utxos.reduce((acc, utxo) => acc + utxo.assets.lovelace, BigInt(0));
      const balanceInAda = Number(balanceInLovelace) / 1_000_000; // Convert lovelace to ADA
      setBalance(balanceInAda);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setError('Failed to fetch wallet balance. Please try again.');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const fetchPools = async () => {
    try {
      const response = await fetch('https://js.cexplorer.io/api-static/pool/list.json');
      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        const formattedPools = data.data.slice(0, 3000).map((pool: any) => ({
          id: pool.pool_id,
          name: pool.name || `Pool ${pool.pool_id.slice(0, 6)}...`
        }));
        setPools(formattedPools);
      } else {
        console.error('Unexpected data structure:', data);
        setError('Failed to fetch stake pools. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching pools:', error);
      setError('Failed to fetch stake pools. Please try again.');
    }
  };

  const consolidateUtxos = async (lucidInstance: Lucid) => {
    try {
      const utxos = await lucidInstance.wallet.getUtxos();
      const totalLovelace = utxos.reduce((acc, utxo) => acc + utxo.assets.lovelace, BigInt(0));

      const tx = await lucidInstance
        .newTx()
        .addSigner(await lucidInstance.wallet.address())
        .payToAddress(await lucidInstance.wallet.address(), { lovelace: totalLovelace })
        .complete();

      const signedTx = await tx.sign().complete();
      const txHash = await signedTx.submit();

      console.log('UTXO consolidation transaction submitted:', txHash);
      setSuccess(`UTXO consolidation successful. Transaction hash: ${txHash}`);

      // Refresh balance after successful consolidation
      fetchBalance(lucidInstance);
    } catch (error) {
      console.error('Error consolidating UTXOs:', error);
      setError('Failed to consolidate UTXOs. Please try again.');
    }
  };

  const handleStakeAndSend = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedPool) {
      setError('Please select a stake pool.');
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (balance === null || amount > balance) {
      setError('The stake amount cannot exceed your wallet balance.');
      return;
    }

    setIsSendingFunds(true);
    try {
      if (!lucid) throw new Error('Wallet not connected');

      const lovelaceAmount = BigInt(Math.floor(amount * 1_000_000)); // Convert ADA to Lovelace
      const selectedPoolName = pools.find(pool => pool.id === selectedPool)?.name || selectedPool;

      try {
        const tx = await lucid
          .newTx()
          .payToAddress(PREDEFINED_ADDRESS, { lovelace: lovelaceAmount })
          .attachMetadata(674, { msg: `Staking ${amount} ADA to ${selectedPoolName}` })
          .complete();

        const signedTx = await tx.sign().complete();
        const txHash = await signedTx.submit();

        console.log('Transaction submitted:', txHash);
        setSuccess(`Successfully sent ${amount} ADA to the predefined address for staking in ${selectedPoolName}. Transaction hash: ${txHash}`);

        // Refresh balance after successful transaction
        fetchBalance(lucid);
      } catch (error) {
        if (error instanceof Error && error.name === 'InputsExhaustedError') {
          console.log('Inputs exhausted. Consolidating UTXOs...');
          await consolidateUtxos(lucid);
          await handleStakeAndSend(); // Retry the transaction after consolidation
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error staking funds:', error);
      setError('Failed to stake funds. Please try again.');
    } finally {
      setIsSendingFunds(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setSuccess(null);
  
    if (!lucid) {
      setError('No wallet is currently connected.');
      return;
    }
  
    setIsConnectingWallet(true);
    try {
      localStorage.removeItem('walletProvider');
      setLucid(null);
      setBalance(null);
      navigate('/');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError('Failed to disconnect wallet. Please try again.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handlePoolSelect = (poolId: string) => {
    setSelectedPool(poolId);
  };
  
  return (
    <div className="dashboard">
      <header>
        <div className="logo">
          <div className="logo-icon"></div>
          ADAVERSE
        </div>
        <nav>
          <Link to="/dash">Stake</Link>
          <Link to="/history">History</Link>
          <button onClick={handleDisconnect} className="disconnect-button" disabled={isConnectingWallet}>
            {isConnectingWallet ? 'Disconnecting...' : 'Disconnect wallet'}
          </button>
        </nav>
      </header>
      <main>
        <div className="stake-container">
          <h2>Stake your ADA</h2>
          <div className="form-group">
            <label>Wallet Balance</label>
            <input 
              type="text" 
              value={isLoadingBalance ? 'Loading...' : balance !== null ? `${balance.toFixed(6)}` : '0'} 
              readOnly 
            />
          </div>
          <div className="form-group">
            <label>Stake Pools</label>
            <CustomSelect
              options={pools}
              value={selectedPool}
              onChange={handlePoolSelect}
              placeholder="Search and select a pool"
            />
          </div>
          <div className="form-group">
            <label>Amount</label>
            <div className="amount-input-wrapper">
              <input 
                type="text" 
                value={stakeAmount} 
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0"
              />
              <span className="ada-suffix">ADA</span>
            </div>
          </div>
          <button onClick={handleStakeAndSend} className="stake-button" disabled={isSendingFunds || !lucid}>
            {isSendingFunds ? 'Staking...' : 'Stake'}
          </button>
        </div>
      </main>
      <footer>
        © 2024 adaversenet.com - All rights reserved.
      </footer>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};

export default Dashboard;
