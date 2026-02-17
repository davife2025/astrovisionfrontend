// src/context/WalletContext.jsx
// Central wallet connection — supports MetaMask, WalletConnect, Coinbase, Brave, and any injected wallet.
// Wrap your app (or just the DAO section) with <WalletProvider> and consume with useWallet().

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// ─── EIP-6963: discover every injected wallet the browser has ────────────────
// Modern wallets (MetaMask, Rabby, Brave, Coinbase extension) all announce
// themselves via this event instead of clobbering window.ethereum.
function getInjectedProviders() {
  return new Promise((resolve) => {
    const providers = [];
    const seen = new Set();

    const handler = (e) => {
      const { info, provider } = e.detail;
      if (!seen.has(info.uuid)) {
        seen.add(info.uuid);
        providers.push({ info, provider });
      }
    };

    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Give wallets 300ms to announce, then resolve
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler);
      // Fallback: if no EIP-6963 wallet found, include window.ethereum if present
      if (providers.length === 0 && window.ethereum) {
        providers.push({
          info: { name: 'Browser Wallet', icon: '', uuid: 'injected' },
          provider: window.ethereum,
        });
      }
      resolve(providers);
    }, 300);
  });
}

// ─── Context ─────────────────────────────────────────────────────────────────
const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const [account, setAccount]           = useState('');
  const [provider, setProvider]         = useState(null); // ethers.BrowserProvider
  const [walletName, setWalletName]     = useState('');
  const [connecting, setConnecting]     = useState(false);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [showPicker, setShowPicker]     = useState(false);
  const [error, setError]               = useState('');

  // disconnect has no external deps — declare it first so others can reference it
  const disconnect = useCallback(() => {
    setAccount('');
    setProvider(null);
    setWalletName('');
    setError('');
  }, []);

  // Stable ref so connectToWallet's event listener always calls the latest disconnect
  // without needing it in the dep array (which would cause an infinite loop)
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  // Connect to a specific wallet from the picker
  const connectToWallet = useCallback(async (wallet) => {
    setConnecting(true);
    setShowPicker(false);
    setError('');
    try {
      const rawProvider = wallet.provider;

      // Request accounts
      const accounts = await rawProvider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned');

      const ethersProvider = new ethers.BrowserProvider(rawProvider);

      setAccount(accounts[0]);
      setProvider(ethersProvider);
      setWalletName(wallet.info.name);

      // Listen for account/chain changes
      rawProvider.on('accountsChanged', (accs) => {
        if (accs.length === 0) {
          disconnectRef.current(); // ref — never stale, no dep needed
        } else {
          setAccount(accs[0]);
        }
      });

      rawProvider.on('chainChanged', () => window.location.reload());

    } catch (err) {
      if (err.code === 4001) {
        setError('Connection rejected by user.');
      } else {
        setError(err.message);
      }
    } finally {
      setConnecting(false);
    }
  }, []); // no deps — only uses stable setters and disconnectRef

  // Stable ref so connect can always call the latest connectToWallet
  // without adding it to connect's dep array
  const connectToWalletRef = useRef(connectToWallet);
  connectToWalletRef.current = connectToWallet;

  // Discover all wallets and open the picker
  const connect = useCallback(async () => {
    setError('');
    setConnecting(true);
    try {
      const wallets = await getInjectedProviders();
      if (wallets.length === 0) {
        setError('No wallet detected. Install MetaMask, Coinbase Wallet, or Brave Wallet.');
        setConnecting(false);
        return;
      }
      if (wallets.length === 1) {
        // Only one wallet — connect immediately, no picker needed
        await connectToWalletRef.current(wallets[0]); // ref — no dep needed
      } else {
        setAvailableWallets(wallets);
        setShowPicker(true);
        setConnecting(false);
      }
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }, []); // no deps — only uses stable setters and connectToWalletRef

  const dismissPicker = useCallback(() => {
    setShowPicker(false);
    setConnecting(false);
  }, []);

  return (
    <WalletContext.Provider value={{
      account,
      provider,       // ethers.BrowserProvider — use this everywhere instead of new ethers.BrowserProvider(window.ethereum)
      walletName,
      connecting,
      connected: !!account,
      error,
      connect,
      disconnect,
    }}>
      {children}

      {/* ── Wallet Picker Modal ───────────────────────────────────────────── */}
      {showPicker && (
        <div onClick={dismissPicker} style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(15, 15, 30, 0.95)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                Connect Wallet
              </h3>
              <button onClick={dismissPicker} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                fontSize: '20px', cursor: 'pointer', lineHeight: 1,
              }}>✕</button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
              Choose a wallet to connect
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {availableWallets.map(wallet => (
                <button key={wallet.info.uuid} onClick={() => connectToWallet(wallet)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  {wallet.info.icon
                    ? <img src={wallet.info.icon} alt={wallet.info.name} style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                    : <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👛</div>
                  }
                  {wallet.info.name}
                </button>
              ))}
            </div>

            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
              Don't have a wallet? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8' }}>Get MetaMask</a>
            </p>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
};