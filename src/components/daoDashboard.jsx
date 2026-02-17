// src/pages/DAODashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import CreateProposalForm from '../components/CreateProposalForm';
import ProposalCard from '../components/ProposalCard';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme.css';

const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS || '0x...';

const DAODashboard = () => {
  // ── Wallet (any wallet, not just MetaMask) ──────────────────────────────────
  const { account, provider, connected, connecting, walletName, connect, disconnect, error: walletError } = useWallet();

  // ── Local state ─────────────────────────────────────────────────────────────
  const [proposals, setProposals]         = useState([]);
  const [userReputation, setUserReputation] = useState(0);
  const [userVoteCount, setUserVoteCount] = useState(0);
  const [loading, setLoading]             = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter]               = useState('all');

  // ── Load proposals — uses provider from WalletContext ───────────────────────
  const loadProposals = useCallback(async () => {
    if (!provider) return;
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const count = await contract.proposalCount();
      const proposalList = [];

      for (let i = 1; i <= Number(count); i++) {
        try {
          const p = await contract.getProposal(i);
          proposalList.push({
            id:            Number(p[0]),
            proposer:      p[1],
            proposalType:  Number(p[2]),
            title:         p[3],
            description:   p[4],
            ipfsHash:      p[5],
            votesFor:      Number(p[6]),
            votesAgainst:  Number(p[7]),
            votesAbstain:  Number(p[8]),
            endTime:       Number(p[9]),
            executionTime: Number(p[10]),
            status:        Number(p[11]),
          });
        } catch (err) {
          console.warn(`Skipping proposal ${i}:`, err.message);
        }
      }
      setProposals(proposalList);
    } catch (error) {
      console.error('Failed to load proposals:', error);
    }
  }, [provider]);

  // ── Load user data — uses provider from WalletContext ───────────────────────
  const loadUserData = useCallback(async () => {
    if (!provider || !account) return;
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const [reputation, voteCount] = await Promise.all([
        contract.userReputation(account).catch(() => 0n),
        contract.userVoteCount(account).catch(() => 0n),
      ]);
      setUserReputation(Number(reputation));
      setUserVoteCount(Number(voteCount));
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }, [provider, account]);

  // ── Load data whenever wallet connects ──────────────────────────────────────
  useEffect(() => {
    if (!connected || !provider) return;

    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...' || !ethers.isAddress(CONTRACT_ADDRESS)) {
      console.error('Contract address not configured');
      return;
    }

    setLoading(true);
    Promise.all([loadProposals(), loadUserData()])
      .finally(() => setLoading(false));
  }, [connected, provider, loadProposals, loadUserData]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleProposalCreated = () => {
    setShowCreateForm(false);
    loadProposals();
    loadUserData();
  };

  const handleVoteSuccess = () => {
    loadProposals();
    loadUserData();
  };

  const filteredProposals = proposals.filter(p => {
    if (filter === 'active')   return p.status === 1;
    if (filter === 'passed')   return p.status === 2;
    if (filter === 'rejected') return p.status === 3;
    return true;
  });

  // ── Not connected — show connect screen ─────────────────────────────────────
  if (!connected) {
    return (
      <div className="dao-dashboard-container">
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="dao-stat-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔗</div>
            <h2 className="dao-text-primary" style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
              Connect Your Wallet
            </h2>
            <p className="dao-text-secondary" style={{ marginBottom: '8px' }}>
              Connect any wallet to participate in AstroDAO governance.
            </p>
            <p className="dao-text-dim" style={{ fontSize: '13px', marginBottom: '28px' }}>
              Supports MetaMask, Coinbase Wallet, Brave Wallet, Rabby, and any EIP-6963 wallet.
            </p>

            {walletError && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                color: '#fca5a5', fontSize: '14px',
              }}>
                {walletError}
              </div>
            )}

            <button onClick={connect} disabled={connecting}
              className="submit-button-primary"
              style={{ width: '100%', fontSize: '16px', padding: '14px' }}>
              {connecting ? '🔄 Connecting...' : '🔗 Connect Wallet'}
            </button>

            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '16px' }}>
              Don't have a wallet?{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
                style={{ color: '#818cf8' }}>Get MetaMask</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Connected — show dashboard ───────────────────────────────────────────────
  return (
    <div className="dao-dashboard-container">

      {/* Header */}
      <div className="dao-header">
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 className="dao-text-primary" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
                🔬 AstroDAO Research
              </h1>
              <p className="dao-text-secondary">Decentralized governance for research topics</p>
            </div>

            {/* Right side — wallet info + buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

              {/* Wallet badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '10px', padding: '8px 14px',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ color: '#c7d2fe', fontSize: '13px', fontFamily: 'monospace' }}>
                  {walletName && <span style={{ color: 'rgba(255,255,255,0.5)', marginRight: '6px' }}>{walletName} ·</span>}
                  {account.substring(0, 6)}...{account.substring(38)}
                </span>
              </div>

              {/* Disconnect button */}
              <button
                onClick={disconnect}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', padding: '8px 16px',
                  color: '#fca5a5', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              >
                Disconnect
              </button>

              <button onClick={() => setShowCreateForm(true)} className="submit-button-primary">
                ✨ Create Proposal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>

          <div className="dao-stat-card">
            <p className="dao-text-dim" style={{ fontSize: '14px', marginBottom: '8px' }}>Connected Account</p>
            <p className="dao-text-primary" style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {account.substring(0, 6)}...{account.substring(38)}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>{walletName}</p>
          </div>

          <div className="dao-stat-card" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
            <p style={{ color: '#a5b4fc', fontSize: '14px', marginBottom: '8px' }}>Your Reputation</p>
            <p className="dao-text-primary" style={{ fontSize: '36px', fontWeight: 'bold' }}>{userReputation}</p>
            <p style={{ color: '#a5b4fc', fontSize: '12px', marginTop: '4px' }}>Max: 10,000</p>
          </div>

          <div className="dao-stat-card" style={{ borderColor: 'rgba(139, 92, 246, 0.3)' }}>
            <p style={{ color: '#c4b5fd', fontSize: '14px', marginBottom: '8px' }}>Votes Cast</p>
            <p className="dao-text-primary" style={{ fontSize: '36px', fontWeight: 'bold' }}>{userVoteCount}</p>
            <p style={{ color: '#c4b5fd', fontSize: '12px', marginTop: '4px' }}>+1 rep per vote</p>
          </div>

          <div className="dao-stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <p style={{ color: '#93c5fd', fontSize: '14px', marginBottom: '8px' }}>Active Proposals</p>
            <p className="dao-text-primary" style={{ fontSize: '36px', fontWeight: 'bold' }}>
              {proposals.filter(p => p.status === 1).length}
            </p>
            <p style={{ color: '#93c5fd', fontSize: '12px', marginTop: '4px' }}>Ready to vote</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',      label: 'All Proposals', count: proposals.length },
            { key: 'active',   label: '🟢 Active',     count: proposals.filter(p => p.status === 1).length },
            { key: 'passed',   label: '✅ Passed',      count: proposals.filter(p => p.status === 2).length },
            { key: 'rejected', label: '❌ Rejected',    count: proposals.filter(p => p.status === 3).length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
              style={{ whiteSpace: 'nowrap' }}>
              {tab.label} <span style={{ opacity: 0.6 }}>({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner-glass" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
            <p className="dao-text-secondary">Loading proposals from blockchain...</p>
            <p className="dao-text-dim" style={{ fontSize: '14px', marginTop: '8px' }}>
              Contract: {CONTRACT_ADDRESS.substring(0, 10)}...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredProposals.length === 0 && (
          <div className="empty-state-glass">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔭</div>
            <h3 className="dao-text-primary" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
              {filter === 'all' ? 'No Proposals Yet' : `No ${filter} proposals`}
            </h3>
            <p className="dao-text-secondary" style={{ marginBottom: '24px' }}>
              {filter === 'all' ? 'Be the first to create a research proposal!' : `No proposals with ${filter} status found`}
            </p>
            {filter === 'all' && (
              <button onClick={() => setShowCreateForm(true)} className="submit-button-primary">
                🚀 Create First Proposal
              </button>
            )}
          </div>
        )}

        {/* Proposals grid */}
        {!loading && filteredProposals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
            {filteredProposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                contractAddress={CONTRACT_ADDRESS}
                userAddress={account}
                onVoteSuccess={handleVoteSuccess}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      {showCreateForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          className="modal-backdrop-blur">
          <div style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            className="create-proposal-modal dao-scrollbar">
            <CreateProposalForm
              contractAddress={CONTRACT_ADDRESS}
              userReputation={userReputation}
              onSuccess={handleProposalCreated}
              onClose={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DAODashboard;