// src/components/DAODashboard.jsx
// Fixed: ENS error resolved + proper contract validation

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import CreateProposalForm from './CreateProposalForm';
import ProposalCard from './ProposalCard';

const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS;
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID) || 56;

// ─── ENS FIX: Validate address before using with ethers ──────────────────────
const isValidContractAddress = (addr) => {
  return addr && addr !== '0x...' && addr !== '' && addr !== 'undefined' && ethers.isAddress(addr);
};

const PROPOSAL_TYPES = [
  { value: 'all', label: 'All' },
  { value: '0', label: 'Weekly Theme' },
  { value: '1', label: 'Research' },
  { value: '2', label: 'Community' },
  { value: '3', label: 'Knowledge' },
  { value: '4', label: 'Collaboration' },
];

const STATUS_CONFIG = {
  0: { label: 'Pending',   bg: 'bg-slate-700',  text: 'text-slate-300',  dot: 'bg-slate-400' },
  1: { label: 'Active',    bg: 'bg-blue-900/60', text: 'text-blue-300',   dot: 'bg-blue-400'  },
  2: { label: 'Passed',    bg: 'bg-green-900/60',text: 'text-green-300',  dot: 'bg-green-400' },
  3: { label: 'Rejected',  bg: 'bg-red-900/60',  text: 'text-red-300',    dot: 'bg-red-400'   },
  4: { label: 'Queued',    bg: 'bg-amber-900/60',text: 'text-amber-300',  dot: 'bg-amber-400' },
  5: { label: 'Executed',  bg: 'bg-purple-900/60',text:'text-purple-300', dot: 'bg-purple-400'},
  6: { label: 'Cancelled', bg: 'bg-slate-800',   text: 'text-slate-400',  dot: 'bg-slate-500' },
};

const DAODashboard = () => {
  const [account, setAccount]                   = useState('');
  const [userReputation, setUserReputation]     = useState(0);
  const [userVoteCount, setUserVoteCount]       = useState(0);
  const [totalVoters, setTotalVoters]           = useState(0);
  const [proposalCount, setProposalCount]       = useState(0);
  const [currentWeek, setCurrentWeek]           = useState(0);
  const [activeWeeklyTheme, setActiveWeeklyTheme] = useState(0);
  const [proposals, setProposals]               = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [showCreateForm, setShowCreateForm]     = useState(false);
  const [filterType, setFilterType]             = useState('all');
  const [connectionError, setConnectionError]   = useState('');
  const [connecting, setConnecting]             = useState(false);
  const [activeView, setActiveView]             = useState('proposals'); // proposals | profile
  const [dashboardError, setDashboardError]     = useState('');

  useEffect(() => {
    if (account) loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // ─── WALLET CONNECTION ──────────────────────────────────────────────────────
  const connectWallet = async () => {
    setConnectionError('');
    setConnecting(true);
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed. Please install it first.');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }).catch((err) => {
        if (err.code === 4001) throw new Error('Please unlock MetaMask and approve the connection.');
        if (err.code === -32002) throw new Error('Connection request pending. Check MetaMask.');
        throw new Error(`MetaMask error: ${err.message}`);
      });

      if (!accounts?.length) throw new Error('No accounts found. Create an account in MetaMask.');

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed1.binance.org'],
                blockExplorerUrls: ['https://bscscan.com'],
              }],
            });
          } else {
            throw new Error('Failed to switch to BNB Chain. Switch manually in MetaMask.');
          }
        }
      }

      setAccount(accounts[0]);

      window.ethereum.on('accountsChanged', (accs) => {
        setAccount(accs[0] || '');
        if (!accs[0]) setConnectionError('Account disconnected');
      });
      window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
      setConnectionError(error.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  // ─── LOAD DATA ──────────────────────────────────────────────────────────────
  const loadDashboardData = async () => {
    setDashboardError('');
    
    // ✅ Validation 1: Check contract address
    if (!isValidContractAddress(CONTRACT_ADDRESS)) {
      const errorMsg = 'DAO contract not configured. Add REACT_APP_DAO_CONTRACT_ADDRESS to .env file';
      console.warn('⚠️', errorMsg);
      setDashboardError(errorMsg);
      setProposals([]);
      setLoading(false);
      return;
    }

    // ✅ Validation 2: Check account is valid
    if (!account || !ethers.isAddress(account)) {
      console.warn('⚠️ Invalid account address');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // ✅ Validation 3: Create provider safely
      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // ✅ Validation 4: Check if contract exists at address
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error(`No contract deployed at ${CONTRACT_ADDRESS.slice(0, 10)}...`);
      }

      // ✅ Now safe to create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      const [reputation, voteCount, totalCount, propCount, week, activeTheme] = await Promise.all([
        contract.userReputation(account).catch(() => 0n),
        contract.userVoteCount(account).catch(() => 0n),
        contract.totalVoterCount().catch(() => 0n),
        contract.proposalCount().catch(() => 0n),
        contract.currentWeek().catch(() => 0n),
        contract.activeWeeklyTheme().catch(() => 0n),
      ]);

      setUserReputation(Number(reputation));
      setUserVoteCount(Number(voteCount));
      setTotalVoters(Number(totalCount));
      setProposalCount(Number(propCount));
      setCurrentWeek(Number(week));
      setActiveWeeklyTheme(Number(activeTheme));

      const proposalsList = [];
      for (let i = 1; i <= Number(propCount); i++) {
        try {
          const p = await contract.getProposal(i);
          proposalsList.push({
            id: Number(p.id),
            proposer: p.proposer,
            proposalType: Number(p.proposalType),
            title: p.title,
            description: p.description,
            ipfsHash: p.ipfsHash,
            votesFor: Number(p.votesFor),
            votesAgainst: Number(p.votesAgainst),
            votesAbstain: Number(p.votesAbstain),
            endTime: Number(p.endTime),
            executionTime: Number(p.executionTime),
            status: Number(p.status),
          });
        } catch (err) {
          console.error(`Error loading proposal ${i}:`, err);
        }
      }
      setProposals(proposalsList.reverse());
      setDashboardError('');
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardError(error.message || 'Failed to load DAO data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = filterType === 'all'
    ? proposals
    : proposals.filter(p => p.proposalType === parseInt(filterType));

  const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  // ─── NOT CONNECTED ──────────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="max-w-md w-full">
          <div className="rounded-3xl p-8 border border-white/10 text-center backdrop-blur-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}>

            <h1 className="text-2xl font-bold text-white mb-3">AstroDAO</h1>
            <p className="text-slate-400 mb-6 text-sm">
              Connect your wallet to participate in governance
            </p>

            {connectionError && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/30 text-red-300 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                {connectionError}
              </div>
            )}

            <button onClick={connectWallet} disabled={connecting}
              className="w-full py-3.5 rounded-xl font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {connecting ? 'Connecting...' : '🔗 Connect Wallet'}
            </button>

            {!isValidContractAddress(CONTRACT_ADDRESS) && (
              <div className="mt-4 p-3 rounded-xl border border-yellow-500/30 text-yellow-300 text-xs"
                style={{ background: 'rgba(245,158,11,0.08)' }}>
                ⚠️ Contract address not configured. Set REACT_APP_DAO_CONTRACT_ADDRESS in .env
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── CONNECTED ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 md:p-8"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">AstroDAO</h1>
            <p className="text-slate-400 text-sm">Connected: {shortAddress(account)}</p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={() => setActiveView('proposals')}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeView === 'proposals'
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={activeView === 'proposals' ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}>
              Proposals
            </button>
            <button onClick={() => setActiveView('profile')}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeView === 'profile'
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={activeView === 'profile' ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}>
              Profile
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {dashboardError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 text-red-300 text-sm flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium mb-1">Configuration Error</p>
              <p>{dashboardError}</p>
            </div>
          </div>
        )}

        {/* Profile View */}
        {activeView === 'profile' ? (
          <ProfilePanel
            account={account}
            userReputation={userReputation}
            userVoteCount={userVoteCount}
            contractAddress={CONTRACT_ADDRESS}
            isValidAddress={isValidContractAddress(CONTRACT_ADDRESS)}
          />
        ) : (
          /* Proposals View */
          <>
            {/* Stats & Create Button */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">Your Reputation</p>
                <p className="text-3xl font-bold text-white">{userReputation}</p>
              </div>
              <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">Votes Cast</p>
                <p className="text-3xl font-bold text-white">{userVoteCount}</p>
              </div>
              <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Proposals</p>
                <p className="text-3xl font-bold text-white">{proposalCount}</p>
                <p className="text-slate-500 text-xs mt-1">{totalVoters} voters</p>
              </div>
              <div className="rounded-2xl p-5 border border-white/10 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                {userReputation >= 3 && isValidContractAddress(CONTRACT_ADDRESS) ? (
                  <button onClick={() => setShowCreateForm(true)}
                    className="w-full h-full py-3 rounded-xl font-medium text-sm text-white transition-all hover:shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    + Create Proposal
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Need {Math.max(0, 3 - userReputation)} more reputation</p>
                    <p className="text-slate-600 text-xs mt-1">to create proposals</p>
                  </div>
                )}
              </div>
            </div>

            {/* Create Form Modal */}
            {showCreateForm && isValidContractAddress(CONTRACT_ADDRESS) && (
              <CreateProposalForm
                contractAddress={CONTRACT_ADDRESS}
                onClose={() => setShowCreateForm(false)}
                onSuccess={() => {
                  setShowCreateForm(false);
                  loadDashboardData();
                }}
                currentWeek={currentWeek}
                activeWeeklyTheme={activeWeeklyTheme}
              />
            )}

            {/* Filter Bar */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {PROPOSAL_TYPES.map(({ value, label }) => (
                <button key={value} onClick={() => setFilterType(value)}
                  className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                    filterType === value
                      ? 'text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  style={filterType === value ? { background: 'rgba(99,102,241,0.2)' } : {}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Proposals List */}
            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                <p className="text-slate-400 mt-4">Loading proposals...</p>
              </div>
            ) : (
              <>
                {filteredProposals.length === 0 ? (
                  <div className="text-center py-20 rounded-2xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-400 text-lg mb-2">
                      {filterType === 'all'
                        ? 'No proposals yet'
                        : `No ${PROPOSAL_TYPES.find(t => t.value === filterType)?.label} proposals`}
                    </p>
                    <p className="text-slate-600 text-sm">
                      {!isValidContractAddress(CONTRACT_ADDRESS)
                        ? 'Contract not configured'
                        : userReputation >= 3
                        ? 'Be the first to create one!'
                        : 'Earn 3 reputation to create proposals'}
                    </p>
                    {userReputation >= 3 && isValidContractAddress(CONTRACT_ADDRESS) && (
                      <button onClick={() => setShowCreateForm(true)}
                        className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                        Create the first proposal →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredProposals.map(proposal => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        contractAddress={CONTRACT_ADDRESS}
                        userAddress={account}
                        onVoteSuccess={loadDashboardData}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── INLINE PROFILE PANEL ──────────────────────────────────────────────────────
const ProfilePanel = ({ account, userReputation, userVoteCount, contractAddress, isValidAddress }) => {
  const [delegate, setDelegate]           = useState('');
  const [delegateInput, setDelegateInput] = useState('');
  const [delegating, setDelegating]       = useState(false);

  useEffect(() => {
    if (isValidAddress && account) loadDelegation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, isValidAddress]);

  const loadDelegation = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const addr = await contract.delegates(account);
      setDelegate(addr === ethers.ZeroAddress ? '' : addr);
    } catch (err) {
      console.error('Failed to load delegation:', err);
    }
  };

  const handleDelegate = async () => {
    if (!ethers.isAddress(delegateInput)) { alert('Invalid address'); return; }
    setDelegating(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.delegate(delegateInput);
      await tx.wait();
      setDelegate(delegateInput);
      setDelegateInput('');
      alert('Delegated successfully!');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') alert('Transaction rejected');
      else alert('Failed to delegate: ' + err.message);
    } finally {
      setDelegating(false);
    }
  };

  const handleUndelegate = async () => {
    setDelegating(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.undelegate();
      await tx.wait();
      setDelegate('');
      alert('Delegation removed!');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') alert('Transaction rejected');
      else alert('Failed to undelegate: ' + err.message);
    } finally {
      setDelegating(false);
    }
  };

  const repPct = Math.min((userReputation / 10000) * 100, 100).toFixed(1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Rep card */}
      <div className="rounded-2xl p-6 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <h2 className="text-xl font-bold text-white mb-6">Your Profile</h2>

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-slate-400 text-sm">Reputation</span>
            <span className="text-white text-sm font-mono">{userReputation} / 10,000</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full transition-all duration-700"
              style={{ width: `${repPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
          </div>
          <p className="text-slate-500 text-xs mt-1">{repPct}% of maximum</p>
        </div>
      </div>

      {/* Delegation card */}
      {isValidAddress && (
        <div className="rounded-2xl p-6 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <h3 className="text-lg font-semibold text-white mb-4">Voting Delegation</h3>

          {delegate ? (
            <div className="p-4 rounded-xl border border-amber-500/25" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="text-amber-300 text-sm mb-2">⚠️ Voting power delegated to:</p>
              <p className="font-mono text-slate-300 text-sm mb-3 break-all">{delegate}</p>
              <p className="text-amber-400/70 text-xs mb-4">You cannot vote while delegating. Remove delegation to vote yourself.</p>
              <button onClick={handleUndelegate} disabled={delegating}
                className="w-full py-2.5 rounded-xl font-medium text-sm border border-amber-500/30 text-amber-300 hover:bg-amber-900/30 disabled:opacity-50 transition-all">
                {delegating ? 'Processing...' : 'Remove Delegation'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Delegate your voting power to another address. They vote on your behalf.</p>
              <input type="text" value={delegateInput} onChange={e => setDelegateInput(e.target.value)}
                placeholder="0x... delegate address"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                disabled={delegating} />
              <button onClick={handleDelegate} disabled={delegating || !delegateInput}
                className="w-full py-3 rounded-xl font-medium text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {delegating ? 'Processing...' : 'Delegate Voting Power'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* How to earn rep */}
      <div className="rounded-2xl p-6 border border-blue-500/20" style={{ background: 'rgba(59,130,246,0.06)' }}>
        <h4 className="text-blue-300 text-sm font-semibold uppercase tracking-wider mb-3">How to Earn Reputation</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            ['🗳️', 'Vote on proposals', '+1 rep'],
            ['📋', 'Create executed proposals', 'Variable'],
            ['⚡', 'Execute proposals', '+5 rep'],
            ['🏆', 'Active participation', 'Admin awarded'],
          ].map(([icon, action, reward]) => (
            <li key={action} className="flex items-center justify-between">
              <span>{icon} {action}</span>
              <span className="text-indigo-400 font-mono text-xs">{reward}</span>
            </li>
          ))}
        </ul>
        <p className="text-slate-600 text-xs mt-3 pt-3 border-t border-white/5">Maximum: 10,000 reputation</p>
      </div>
    </div>
  );
};

export { STATUS_CONFIG };
export default DAODashboard;