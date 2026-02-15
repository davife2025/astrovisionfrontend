// src/components/DAODashboard.jsx
// Complete version — all state used in JSX, no ESLint errors

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import CreateProposalForm from './CreateProposalForm';
import ProposalCard from './ProposalCard';
import UserProfile from './UserProfile';

const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS;
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID) || 56;

const isValidContractAddress = (addr) =>
  addr && addr !== '0x...' && addr !== '' && addr !== 'undefined' && ethers.isAddress(addr);

const PROPOSAL_TYPES = [
  { value: 'all', label: 'All' },
  { value: '0',   label: '🌟 Weekly Theme' },
  { value: '1',   label: '🔭 Research' },
  { value: '2',   label: '🌍 Community' },
  { value: '3',   label: '📚 Knowledge' },
  { value: '4',   label: '🤝 Collaboration' },
];

const DAODashboard = () => {
  // User state
  const [account, setAccount]               = useState('');
  const [userReputation, setUserReputation] = useState(0);
  const [userVoteCount, setUserVoteCount]   = useState(0);

  // Contract state
  const [totalVoters, setTotalVoters]             = useState(0);
  const [proposalCount, setProposalCount]         = useState(0);
  const [currentWeek, setCurrentWeek]             = useState(0);
  const [activeWeeklyTheme, setActiveWeeklyTheme] = useState(0);
  const [proposals, setProposals]                 = useState([]);
  const [isPaused, setIsPaused]                   = useState(false);
  const [isOwner, setIsOwner]                     = useState(false);
  const [governanceParams, setGovernanceParams]   = useState({
    votingPeriod: 7, quickVotePeriod: 3, minVotesRequired: 5,
    quorumPercentage: 10, executionDelay: 2, proposalThreshold: 3,
  });

  // UI state
  const [loading, setLoading]                   = useState(false);
  const [showCreateForm, setShowCreateForm]     = useState(false);
  const [filterType, setFilterType]             = useState('all');
  const [connectionError, setConnectionError]   = useState('');
  const [connecting, setConnecting]             = useState(false);
  const [activeView, setActiveView]             = useState('proposals');
  const [dashboardError, setDashboardError]     = useState('');

  useEffect(() => {
    if (account) {
      loadDashboardData();
      loadGovernanceParams();
      checkPausedStatus();
      checkOwnerStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // ── Load governance params ─────────────────────────────────────────────────
  const loadGovernanceParams = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS)) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const [vp, qvp, mv, q, ed, pt] = await Promise.all([
        contract.votingPeriod().catch(() => 604800n),
        contract.quickVotePeriod().catch(() => 259200n),
        contract.minVotesRequired().catch(() => 5n),
        contract.quorumPercentage().catch(() => 10n),
        contract.executionDelay().catch(() => 172800n),
        contract.proposalThreshold().catch(() => 3n),
      ]);
      setGovernanceParams({
        votingPeriod:      Number(vp)  / 86400,
        quickVotePeriod:   Number(qvp) / 86400,
        minVotesRequired:  Number(mv),
        quorumPercentage:  Number(q),
        executionDelay:    Number(ed)  / 86400,
        proposalThreshold: Number(pt),
      });
    } catch (err) {
      console.error('Error loading governance params:', err);
    }
  };

  // ── Check paused ───────────────────────────────────────────────────────────
  const checkPausedStatus = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS)) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const paused = await contract.paused();
      setIsPaused(paused);
      if (paused) setDashboardError('⚠️ Contract is paused. All transactions are disabled.');
    } catch (err) {
      console.error('Error checking pause status:', err);
    }
  };

  // ── Check owner ────────────────────────────────────────────────────────────
  const checkOwnerStatus = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS) || !account) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
    } catch (err) {
      console.error('Error checking owner:', err);
    }
  };

  // ── Connect wallet ─────────────────────────────────────────────────────────
  const connectWallet = async () => {
    setConnectionError('');
    setConnecting(true);
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed.');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }).catch((err) => {
        if (err.code === 4001)   throw new Error('Please approve the connection in MetaMask.');
        if (err.code === -32002) throw new Error('Connection request pending — check MetaMask.');
        throw new Error(`MetaMask error: ${err.message}`);
      });

      if (!accounts?.length) throw new Error('No accounts found.');

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
            throw new Error('Failed to switch to BNB Chain.');
          }
        }
      }

      setAccount(accounts[0]);
      window.ethereum.on('accountsChanged', (accs) => {
        setAccount(accs[0] || '');
        if (!accs[0]) setConnectionError('Wallet disconnected');
      });
      window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
      setConnectionError(error.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  // ── Load dashboard data ────────────────────────────────────────────────────
  const loadDashboardData = async () => {
    setDashboardError('');

    if (!isValidContractAddress(CONTRACT_ADDRESS)) {
      setDashboardError('Contract not configured. Add REACT_APP_DAO_CONTRACT_ADDRESS to .env');
      setProposals([]);
      setLoading(false);
      return;
    }

    if (!account || !ethers.isAddress(account)) { setLoading(false); return; }

    try {
      setLoading(true);
      if (!window.ethereum) throw new Error('MetaMask not found');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') throw new Error(`No contract at ${CONTRACT_ADDRESS.slice(0, 10)}...`);

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
            id:            Number(p.id),
            proposer:      p.proposer,
            proposalType:  Number(p.proposalType),
            title:         p.title,
            description:   p.description,
            ipfsHash:      p.ipfsHash,
            votesFor:      Number(p.votesFor),
            votesAgainst:  Number(p.votesAgainst),
            votesAbstain:  Number(p.votesAbstain),
            endTime:       Number(p.endTime),
            executionTime: Number(p.executionTime),
            status:        Number(p.status),
          });
        } catch (err) {
          console.error(`Error loading proposal ${i}:`, err);
        }
      }
      setProposals(proposalsList.reverse());
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

  const shortAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

  // ── NOT CONNECTED ──────────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #0a0a1a, #0d0d2b, #0a0a1a)' }}>

        {/* Stars */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                width:   Math.random() * 2 + 1 + 'px',
                height:  Math.random() * 2 + 1 + 'px',
                top:     Math.random() * 100 + '%',
                left:    Math.random() * 100 + '%',
                opacity: Math.random() * 0.6 + 0.1,
              }} />
          ))}
        </div>

        <div className="relative z-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
            <span className="text-4xl">🌌</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>AstroDAO</h1>
          <p className="text-indigo-300 text-sm tracking-widest uppercase mb-8">Community Governance · BNB Chain</p>

          {connectionError && (
            <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-900/20 text-left">
              <p className="text-red-300 text-sm">⚠️ {connectionError}</p>
            </div>
          )}

          {!isValidContractAddress(CONTRACT_ADDRESS) && (
            <div className="mb-5 p-4 rounded-xl border border-amber-500/30 bg-amber-900/10">
              <p className="text-amber-300 text-xs">
                ⚠️ Contract not configured — set{' '}
                <code className="bg-amber-900/40 px-1 rounded">REACT_APP_DAO_CONTRACT_ADDRESS</code> in .env
              </p>
            </div>
          )}

          <button onClick={connectWallet} disabled={connecting}
            className="w-full py-4 rounded-2xl font-semibold text-white text-lg transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 30px rgba(99,102,241,0.35)' }}>
            {connecting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Connecting...
              </span>
            ) : '🔗 Connect MetaMask'}
          </button>

          <p className="text-slate-600 text-xs mt-4">Requires MetaMask · BNB Smart Chain</p>
        </div>
      </div>
    );
  }

  // ── CONNECTED ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0a0a1a, #0d0d2b, #0a0a1a)' }}>

      {/* Paused banner */}
      {isPaused && (
        <div className="bg-red-900/60 border-b border-red-500/30 px-4 py-2 text-center">
          <p className="text-red-300 text-sm font-medium">⏸️ Contract is paused — transactions disabled</p>
        </div>
      )}

      {/* Owner banner */}
      {isOwner && (
        <div className="bg-purple-900/40 border-b border-purple-500/20 px-4 py-2 text-center">
          <p className="text-purple-300 text-xs">👑 You are the contract owner · Week #{currentWeek}</p>
        </div>
      )}

      {/* ── NAV ── */}
      <div className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(10,10,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <span className="text-2xl">🌌</span>
            <div>
              <h1 className="text-white font-bold leading-none" style={{ fontFamily: 'Georgia, serif' }}>AstroDAO</h1>
              <p className="text-indigo-400 text-xs">Week #{currentWeek}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {[
              { id: 'proposals', label: '📋 Proposals' },
              { id: 'profile',   label: '👤 Profile' },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => { setActiveView(tab.id); setShowCreateForm(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Wallet badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-300 text-sm font-mono">{shortAddr(account)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Error banner */}
        {dashboardError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-900/20 flex items-start gap-3">
            <span className="text-red-400 mt-0.5">⚠️</span>
            <p className="text-red-300 text-sm">{dashboardError}</p>
          </div>
        )}

        {/* ── PROFILE VIEW ── */}
        {activeView === 'profile' && (
          <UserProfile
            contractAddress={CONTRACT_ADDRESS}
            userAddress={account}
          />
        )}

        {/* ── PROPOSALS VIEW ── */}
        {activeView === 'proposals' && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Your Reputation', value: userReputation, sub: `/ ${governanceParams.proposalThreshold} to propose`, color: '#818cf8', icon: '⭐' },
                { label: 'Votes Cast',      value: userVoteCount,  sub: '+1 rep per vote',        color: '#34d399', icon: '🗳️' },
                { label: 'Total Proposals', value: proposalCount,  sub: `Week #${currentWeek}`,   color: '#a78bfa', icon: '📋' },
                { label: 'Total Voters',    value: totalVoters,    sub: 'Unique participants',     color: '#60a5fa', icon: '👥' },
              ].map(stat => (
                <div key={stat.label} className="relative rounded-2xl p-5 border border-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="absolute top-3 right-3 text-xl opacity-40">{stat.icon}</div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{stat.label}</p>
                  <p className="text-4xl font-bold" style={{ color: stat.color, fontFamily: 'Georgia, serif' }}>{stat.value}</p>
                  <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Governance params row */}
            <div className="mb-8 p-4 rounded-2xl border border-blue-500/15 grid grid-cols-2 md:grid-cols-4 gap-3"
              style={{ background: 'rgba(59,130,246,0.05)' }}>
              {[
                ['Voting Period',  `${governanceParams.votingPeriod}d`],
                ['Quick Vote',     `${governanceParams.quickVotePeriod}d`],
                ['Min Votes',      governanceParams.minVotesRequired],
                ['Quorum',         `${governanceParams.quorumPercentage}%`],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className="text-blue-300 font-semibold text-sm">{value}</p>
                </div>
              ))}
            </div>

            {/* Active weekly theme */}
            {activeWeeklyTheme > 0 && (
              <div className="mb-8 p-5 rounded-2xl border border-purple-500/30 flex items-center gap-4"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))' }}>
                <span className="text-3xl">🌟</span>
                <div>
                  <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-1">Active Weekly Theme</p>
                  <p className="text-white font-medium">Proposal #{activeWeeklyTheme} is the featured theme</p>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {showCreateForm ? 'New Proposal' : 'Governance Proposals'}
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  {showCreateForm ? 'Submit to the community' : `${filteredProposals.length} proposals`}
                </p>
              </div>

              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  disabled={userReputation < governanceParams.proposalThreshold || isPaused}
                  title={
                    isPaused ? 'Contract is paused'
                    : userReputation < governanceParams.proposalThreshold
                    ? `Need ${governanceParams.proposalThreshold} reputation`
                    : ''
                  }
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
                  + New Proposal
                </button>
              ) : (
                <button onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-slate-400 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  ← Back
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreateForm && (
              <CreateProposalForm
                contractAddress={CONTRACT_ADDRESS}
                userReputation={userReputation}
                governanceParams={governanceParams}
                isPaused={isPaused}
                onSuccess={() => { setShowCreateForm(false); loadDashboardData(); }}
              />
            )}

            {/* Filter + list */}
            {!showCreateForm && (
              <>
                <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {PROPOSAL_TYPES.map(type => (
                    <button key={type.value} onClick={() => setFilterType(type.value)}
                      className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterType === type.value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}>
                      {type.label}
                    </button>
                  ))}
                </div>

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
                        ? 'Configure contract address to load proposals'
                        : filterType !== 'all'
                        ? 'No proposals of this type yet'
                        : userReputation >= governanceParams.proposalThreshold
                        ? 'Be the first to create one!'
                        : `Earn ${governanceParams.proposalThreshold} reputation to create proposals`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredProposals.map(proposal => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        contractAddress={CONTRACT_ADDRESS}
                        userAddress={account}
                        executionDelay={governanceParams.executionDelay}
                        isPaused={isPaused}
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

export default DAODashboard;