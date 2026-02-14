// src/components/DAODashboard.jsx
// Fixed: ENS error resolved by validating CONTRACT_ADDRESS before use

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import CreateProposalForm from './CreateProposalForm';
import ProposalCard from './ProposalCard';

const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS;
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID) || 56;

// ─── ENS FIX: Validate address before using with ethers ──────────────────────
const isValidContractAddress = (addr) => {
  return addr && addr !== '0x...' && addr !== '' && ethers.isAddress(addr);
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
    // ✅ ENS FIX: Guard against invalid/placeholder contract address
    if (!isValidContractAddress(CONTRACT_ADDRESS)) {
      console.warn('⚠️ DAO contract address not configured. Set REACT_APP_DAO_CONTRACT_ADDRESS in .env');
      setProposals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      const [reputation, voteCount, totalCount, propCount, week, activeTheme] = await Promise.all([
        contract.userReputation(account),
        contract.userVoteCount(account),
        contract.totalVoterCount(),
        contract.proposalCount(),
        contract.currentWeek(),
        contract.activeWeeklyTheme(),
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
    } catch (error) {
      console.error('Error loading dashboard:', error);
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
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)' }}>

        {/* Stars background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {[...Array(60)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 2 + 1 + 'px',
                height: Math.random() * 2 + 1 + 'px',
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                opacity: Math.random() * 0.6 + 0.2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Logo / icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
              <span className="text-4xl">🌌</span>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>
            AstroDAO
          </h1>
          <p className="text-indigo-300 mb-10 text-sm tracking-widest uppercase">
            Community Governance · BNB Chain
          </p>

          {/* Error */}
          {connectionError && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-900/20 text-left">
              <p className="text-red-300 text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{connectionError}</span>
              </p>
            </div>
          )}

          {/* Connect button */}
          <button onClick={connectWallet} disabled={connecting}
            className="w-full py-4 px-8 rounded-2xl font-semibold text-white text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: connecting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: connecting ? 'none' : '0 0 30px rgba(99,102,241,0.35)',
            }}>
            {connecting ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Connecting...
              </span>
            ) : '🔗 Connect MetaMask'}
          </button>

          {/* Info cards */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-900/10">
              <p className="text-indigo-300 text-xs font-semibold mb-2 uppercase tracking-wider">Before connecting</p>
              <ul className="text-slate-400 text-xs space-y-1">
                <li>• Unlock MetaMask</li>
                <li>• Have an account ready</li>
                <li>• Approve the request</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-900/10">
              <p className="text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wider">No MetaMask?</p>
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors">
                Install MetaMask →
              </a>
              <p className="text-slate-500 text-xs mt-2">Free browser extension</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CONNECTED DASHBOARD ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)' }}>

      {/* Contract not configured warning */}
      {!isValidContractAddress(CONTRACT_ADDRESS) && (
        <div className="bg-amber-900/40 border-b border-amber-500/30 px-4 py-3 text-center">
          <p className="text-amber-300 text-sm">
            ⚠️ <strong>Contract not configured.</strong> Set <code className="bg-amber-900/50 px-1 rounded">REACT_APP_DAO_CONTRACT_ADDRESS</code> in your <code className="bg-amber-900/50 px-1 rounded">.env</code> file to enable DAO features.
          </p>
        </div>
      )}

      {/* ── TOP NAV BAR ── */}
      <div className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌌</span>
            <div>
              <h1 className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'Georgia, serif' }}>AstroDAO</h1>
              <p className="text-indigo-400 text-xs">Week #{currentWeek}</p>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {[
              { id: 'proposals', label: '📋 Proposals' },
              { id: 'profile',   label: '👤 Profile' },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveView(tab.id); setShowCreateForm(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Wallet badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-300 text-sm font-mono">{shortAddress(account)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Your Reputation', value: userReputation, sub: '/ 10,000 max', color: '#818cf8', icon: '⭐' },
            { label: 'Votes Cast',      value: userVoteCount,  sub: '+1 rep per vote', color: '#34d399', icon: '🗳️' },
            { label: 'Total Proposals', value: proposalCount,  sub: `Week #${currentWeek}`, color: '#a78bfa', icon: '📋' },
            { label: 'Total Voters',    value: totalVoters,    sub: 'Unique participants', color: '#60a5fa', icon: '👥' },
          ].map((stat) => (
            <div key={stat.label} className="relative overflow-hidden rounded-2xl p-5 border border-white/5"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="absolute top-3 right-3 text-xl opacity-40">{stat.icon}</div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">{stat.label}</p>
              <p className="text-4xl font-bold" style={{ color: stat.color, fontFamily: 'Georgia, serif' }}>{stat.value}</p>
              <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── ACTIVE WEEKLY THEME BANNER ── */}
        {activeWeeklyTheme > 0 && (
          <div className="mb-8 p-5 rounded-2xl border border-purple-500/30 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
            <span className="text-3xl">🌟</span>
            <div>
              <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-1">Active Weekly Theme</p>
              <p className="text-white font-medium">Proposal #{activeWeeklyTheme} is the featured theme this week</p>
            </div>
          </div>
        )}

        {/* ── PROFILE VIEW ── */}
        {activeView === 'profile' && (
          <ProfilePanel
            account={account}
            userReputation={userReputation}
            userVoteCount={userVoteCount}
            contractAddress={CONTRACT_ADDRESS}
            isValidAddress={isValidContractAddress(CONTRACT_ADDRESS)}
          />
        )}

        {/* ── PROPOSALS VIEW ── */}
        {activeView === 'proposals' && (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {showCreateForm ? 'New Proposal' : 'Governance Proposals'}
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  {showCreateForm ? 'Submit a new proposal to the community' : `${filteredProposals.length} proposals found`}
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                disabled={userReputation < 3}
                title={userReputation < 3 ? 'Need 3 reputation to create proposals' : ''}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: showCreateForm ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: showCreateForm ? 'none' : '0 0 20px rgba(99,102,241,0.3)',
                  color: 'white',
                }}>
                {showCreateForm ? '← Back to Proposals' : '+ New Proposal'}
              </button>
            </div>

            {/* Create proposal form */}
            {showCreateForm ? (
              <CreateProposalForm
                contractAddress={CONTRACT_ADDRESS}
                userReputation={userReputation}
                onSuccess={() => { setShowCreateForm(false); loadDashboardData(); }}
              />
            ) : (
              <>
                {/* Filter tabs */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {PROPOSAL_TYPES.map(type => (
                    <button key={type.value} onClick={() => setFilterType(type.value)}
                      className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        filterType === type.value
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}>
                      {type.label}
                    </button>
                  ))}
                </div>

                {/* Proposals list */}
                {loading ? (
                  <div className="text-center py-20">
                    <div className="inline-block w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
                    <p className="text-slate-400">Loading proposals from chain...</p>
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <div className="text-center py-20 rounded-2xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-4xl mb-4">🔭</p>
                    <p className="text-slate-400 font-medium mb-2">No proposals found</p>
                    <p className="text-slate-600 text-sm">
                      {!isValidContractAddress(CONTRACT_ADDRESS)
                        ? 'Configure your contract address to see proposals'
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
 // const shortAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

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

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-indigo-500/20" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">Votes Cast</p>
            <p className="text-3xl font-bold text-indigo-300" style={{ fontFamily: 'Georgia, serif' }}>{userVoteCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-purple-500/20" style={{ background: 'rgba(139,92,246,0.08)' }}>
            <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">Reputation</p>
            <p className="text-3xl font-bold text-purple-300" style={{ fontFamily: 'Georgia, serif' }}>{userReputation}</p>
          </div>
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