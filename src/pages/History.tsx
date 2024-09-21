import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lucid, Blockfrost, Network } from 'lucid-cardano';
import './History.css';

const ITEMS_PER_PAGE = 8;
const BLOCKFROST_API_KEY = 'mainnetuE7K083WTQTQXf6N8OdK9cJmWkxCY2jH';

interface Transaction {
  txHash: string;
  block: string;
  time: string;
  amount: string;
  status: 'Ongoing' | 'Incoming';
}

interface DelegateTransaction {
  transaction: string;
  time: string;
  block: string;
  poolId: string;
}

const History: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [delegateTransactions, setDelegateTransactions] = useState<DelegateTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [delegateCurrentPage, setDelegateCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [delegateTotalPages, setDelegateTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDelegateLoading, setIsDelegateLoading] = useState(true);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [lucid, setLucid] = useState<Lucid | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    initializeLucid();
  }, []);

  useEffect(() => {
    if (lucid) {
      fetchTransactions();
      fetchDelegateTransactions();
    }
  }, [lucid, currentPage, delegateCurrentPage]);

  const initializeLucid = async () => {
    try {
      const lucidInstance = await Lucid.new(
        new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', BLOCKFROST_API_KEY),
        'Mainnet' as Network
      );
      
      const walletProvider = localStorage.getItem('walletProvider');
      if (walletProvider) {
        const wallet = (window as any).cardano[walletProvider];
        if (wallet) {
          const api = await wallet.enable();
          lucidInstance.selectWallet(api);
          setLucid(lucidInstance);
        } else {
          setError('Wallet not found. Please reconnect your wallet.');
        }
      } else {
        setError('No wallet connected. Please connect your wallet.');
      }
    } catch (err) {
      console.error('Error initializing Lucid:', err);
      setError('Failed to initialize wallet. Please try again.');
    }
  };

  const fetchTransactions = async () => {
    if (!lucid) return;
    setIsLoading(true);
    setError(null);
    try {
      const address = await lucid.wallet.address();
      const fetchedTransactions = await fetchWalletTransactions(address);
      setTransactions(fetchedTransactions);
      setTotalPages(Math.ceil(fetchedTransactions.length / ITEMS_PER_PAGE));
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletTransactions = async (address: string): Promise<Transaction[]> => {
    const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/addresses/${address}/transactions?order=desc`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const data = await response.json();
    
    return await Promise.all(data.map(async (tx: any) => {
      const txDetails = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/txs/${tx.tx_hash}`, {
        headers: {
          'project_id': BLOCKFROST_API_KEY
        }
      }).then(res => res.json());

      const amount = txDetails.output_amount
        .find((output: any) => output.unit === 'lovelace')
        .quantity / 1000000; // Convert lovelace to ADA

      return {
        txHash: tx.tx_hash,
        block: tx.block_height.toString(),
        time: new Date(txDetails.block_time * 1000).toLocaleString([], { hour: '2-digit', minute: '2-digit' }),
        amount: amount.toFixed(5),
        status: Math.random() > 0.5 ? 'Ongoing' : 'Incoming' // Randomize status for demonstration
      };
    }));
  };

  const fetchDelegateTransactions = async () => {
    if (!lucid) return;
    setIsDelegateLoading(true);
    setDelegateError(null);
    try {
      const address = await lucid.wallet.address();
      const stakeAddress = await getStakeAddress(address);
      if (stakeAddress) {
        const fetchedDelegateTransactions = await fetchWalletDelegateTransactions(stakeAddress);
        setDelegateTransactions(fetchedDelegateTransactions);
        setDelegateTotalPages(Math.ceil(fetchedDelegateTransactions.length / ITEMS_PER_PAGE));
      } else {
        setDelegateError('Unable to retrieve stake address from wallet.');
      }
    } catch (err) {
      console.error('Error fetching delegate transactions:', err);
      setDelegateError(`Failed to fetch delegate transactions. ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setIsDelegateLoading(false);
    }
  };

  const getStakeAddress = async (address: string): Promise<string | null> => {
    try {
      const { stakeCredential } = lucid!.utils.getAddressDetails(address);
      if (stakeCredential) {
        return lucid!.utils.credentialToRewardAddress(stakeCredential);
      }
      return null;
    } catch (error) {
      console.error('Error getting stake address:', error);
      return null;
    }
  };

  const fetchWalletDelegateTransactions = async (stakeAddress: string): Promise<DelegateTransaction[]> => {
    try {
      const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/accounts/${stakeAddress}/delegations`, {
        headers: {
          'project_id': BLOCKFROST_API_KEY
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Unexpected data structure:', data);
        throw new Error('Received data is not an array');
      }

      return data.map((delegation: any) => ({
        transaction: delegation.tx_hash || 'N/A',
        time: delegation.active_epoch ? new Date(delegation.active_epoch * 432000000).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        block: delegation.block_height ? delegation.block_height.toString() : 'N/A',
        poolId: delegation.pool_id || 'N/A'
      }));
    } catch (error) {
      console.error('Error in fetchWalletDelegateTransactions:', error);
      throw new Error(`Failed to fetch delegate transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnectingWallet(true);
      localStorage.removeItem('walletProvider');
      if (lucid) {
        // Instead of lucid.selectWallet(null), which causes a TypeScript error
        setLucid(null);
      }
      setTransactions([]);
      setDelegateTransactions([]);
      navigate('/');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError('Failed to disconnect wallet. Please try again.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const paginatedDelegateTransactions = delegateTransactions.slice(
    (delegateCurrentPage - 1) * ITEMS_PER_PAGE,
    delegateCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="history-page">
      <header>
        <div className="logo">
          <div className="logo-icon"></div>
          ADAVERSE
        </div>
        <nav>
          <Link to="/dash">Stake</Link>
          <Link to="/history">History</Link>
        </nav>
        <button onClick={handleDisconnect} className="disconnect-button" disabled={isConnectingWallet}>
          {isConnectingWallet ? 'Disconnecting...' : 'Disconnect wallet'}
        </button>
      </header>

      <main>
        <section className="recent-transactions">
          <h2>Recent Transaction</h2>
          {isLoading ? (
            <div className="preloader">
              <div className="spinner"></div>
              <p>Loading transactions...</p>
            </div>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : (
            <>
              <div className="table-container">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Trx Hash</th>
                      <th>Block</th>
                      <th>Time</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx, index) => (
                      <tr key={index}>
                        <td>{tx.txHash}</td>
                        <td>{tx.block}</td>
                        <td>{tx.time}</td>
                        <td>{tx.amount}</td>
                        <td className={tx.status.toLowerCase()}>{tx.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <p>Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} of {transactions.length} entries</p>
                <div className="pagination-controls">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? 'active' : ''}
                    >
                      {page.toString().padStart(2, '0')}
                    </button>
                  ))}
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                    &gt;
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="delegate-history">
          <h2>Delegate History</h2>
          {isDelegateLoading ? (
            <div className="preloader">
              <div className="spinner"></div>
              <p>Loading delegate transactions...</p>
            </div>
          ) : delegateError ? (
            <p className="error-message">{delegateError}</p>
          ) : (
            <>
              <div className="table-container">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Time</th>
                      <th>Block</th>
                      <th>Pool ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDelegateTransactions.map((tx, index) => (
                      <tr key={index}>
                        <td>{tx.transaction}</td>
                        <td>{tx.time}</td>
                        <td>{tx.block}</td>
                        <td>{tx.poolId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <p>Showing {(delegateCurrentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(delegateCurrentPage * ITEMS_PER_PAGE, delegateTransactions.length)} of {delegateTransactions.length} entries</p>
                <div className="pagination-controls">
                  <button onClick={() => setDelegateCurrentPage(prev => Math.max(prev - 1, 1))} disabled={delegateCurrentPage === 1}>
                    &lt;
                  </button>
                  {Array.from({ length: delegateTotalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setDelegateCurrentPage(page)}
                      className={delegateCurrentPage === page ? 'active' : ''}
                    >
                      {page.toString().padStart(2, '0')}
                    </button>
                  ))}
                  <button onClick={() => setDelegateCurrentPage(prev => Math.min(prev + 1, delegateTotalPages))} disabled={delegateCurrentPage === delegateTotalPages}>
                    &gt;
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer>
        <p>© 2024 adaversenet.com - All rights reserved.</p>
      </footer>
    </div>
  );
};

export default History;