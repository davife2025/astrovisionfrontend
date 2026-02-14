// src/components/ProposalCard.jsx
// Aligned with AstroDAOSecure.sol - Space dark theme

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';

const PROPOSAL_TYPE_LABELS = {
  0: 'Weekly Theme',
  1: 'Research Discovery',
  2: 'Community Proposal',
  3: 'Knowledge Sharing',
  4: 'Collaboration',
};

const STATUS_CONFIG = {
  0: { label: 'Pending',   border: 'border-slate-600',   badge: 'bg-slate-700 text-slate-300',    dot: 'bg-slate-400' },
  1: { label: 'Active',    border: 'border-blue-500/50',  badge: 'bg-blue-900/60 text-blue-300',   dot: 'bg-blue-400 animate-pulse' },
  2: { label: 'Passed',    border: 'border-green-500/50', badge: 'bg-green-900/60 text-green-300', dot: 'bg-green-400' },
  3: { label: 'Rejected',  border: 'border-red-500/50',   badge: 'bg-red-900/60 text-red-300',     dot: 'bg-red-400' },
  4: { label: 'Queued',    border: 'border-amber-500/50', badge: 'bg-amber-900/60 text-amber-300', dot: 'bg-amber-400' },
  5: { label: 'Executed',  border: 'border-purple-500/50',badge: 'bg-purple-900/60 text-purple-300',dot:'bg-purple-400' },
  6: { label: 'Cancelled', border: 'border-slate-600',    badge: 'bg-slate-800 text-slate-500',    dot: 'bg-slate-500' },
};

const TYPE_COLORS = {
  0: 'text-indigo-400', 1: 'text-blue-400',
  2: 'text-purple-400', 3: 'text-teal-400', 4: 'text-pink-400',
};

const VOTE_CHOICES = { AGAINST: 0, FOR: 1, ABSTAIN: 2 };

const ProposalCard = ({ proposal, contractAddress, userAddress, onVoteSuccess }) => {
  const [voting, setVoting]   = useState(false);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleVote = async (choice) => {
    setError('');
    setVoting(true);
    try {
      if (!window.ethereum) throw new Error('MetaMask not installed');
      if (!contractAddress || contractAddress === '0x...' || !ethers.isAddress(contractAddress)) {
        throw new Error('Contract address not configured');
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.vote(proposal.id, choice);
      await tx.wait();
      if (onVoteSuccess) onVoteSuccess();
      alert('Vote cast! +1 Reputation earned 🎉');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else if (err.message.includes('AlreadyVoted')) setError('You already voted on this proposal');
      else if (err.message.includes('AlreadyDelegated')) setError('Cannot vote — voting power is delegated');
      else if (err.message.includes('Voting period ended')) setError('Voting period has ended');
      else setError(err.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  const handleFinalize = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.finalizeProposal(proposal.id);
      await tx.wait();
      if (onVoteSuccess) onVoteSuccess();
      alert('Proposal finalized!');
    } catch (err) { alert('Failed to finalize: ' + err.message); }
  };

  const handleExecute = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.executeProposal(proposal.id);
      await tx.wait();
      if (onVoteSuccess) onVoteSuccess();
      alert('Proposal executed! +5 Reputation earned 🎉');
    } catch (err) { alert('Failed to execute: ' + err.message); }
  };

  const totalVotes    = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const forPct        = totalVotes > 0 ? (proposal.votesFor / totalVotes * 100).toFixed(1) : 0;
  const againstPct    = totalVotes > 0 ? (proposal.votesAgainst / totalVotes * 100).toFixed(1) : 0;
  const abstainPct    = totalVotes > 0 ? (proposal.votesAbstain / totalVotes * 100).toFixed(1) : 0;

  const now          = Math.floor(Date.now() / 1000);
  const isActive     = proposal.status === 1 && now <= proposal.endTime;
  const canFinalize  = proposal.status === 1 && now > proposal.endTime;
  const canExecute   = proposal.status === 4 && now >= proposal.executionTime;
  const statusCfg    = STATUS_CONFIG[proposal.status] || STATUS_CONFIG[0];
  const isOwn        = proposal.proposer?.toLowerCase() === userAddress?.toLowerCase();

  const shortAddr = (a) => `${a?.slice(0, 6)}...${a?.slice(-4)}`;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-300 hover:border-opacity-80 ${statusCfg.border}`}
      style={{ background: 'rgba(255,255,255,0.025)' }}>

      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold uppercase tracking-wider ${TYPE_COLORS[proposal.proposalType]}`}>
                {PROPOSAL_TYPE_LABELS[proposal.proposalType]}
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-slate-500 text-xs font-mono">#{proposal.id}</span>
              {isOwn && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-500/30">
                  Your proposal
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-lg leading-snug">{proposal.title}</h3>
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${statusCfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className={`text-slate-400 text-sm leading-relaxed ${!expanded && 'line-clamp-2'}`}>
            {proposal.description}
          </p>
          {proposal.description?.length > 120 && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 transition-colors">
              {expanded ? 'Show less ↑' : 'Read more ↓'}
            </button>
          )}
        </div>

        {/* IPFS link */}
        {proposal.ipfsHash && (
          <a href={proposal.ipfsHash} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs mb-4 transition-colors">
            📄 Supporting documents →
          </a>
        )}

        {/* Vote stats */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{totalVotes} total votes</span>
            <span>{isActive
              ? `Ends ${new Date(proposal.endTime * 1000).toLocaleDateString()}`
              : `Ended ${new Date(proposal.endTime * 1000).toLocaleDateString()}`}
            </span>
          </div>

          {/* For */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400 font-medium">✓ For — {proposal.votesFor}</span>
              <span className="text-green-500">{forPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-green-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
            </div>
          </div>

          {/* Against */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400 font-medium">✗ Against — {proposal.votesAgainst}</span>
              <span className="text-red-500">{againstPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-red-500 transition-all duration-500" style={{ width: `${againstPct}%` }} />
            </div>
          </div>

          {/* Abstain */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 font-medium">◌ Abstain — {proposal.votesAbstain}</span>
              <span className="text-slate-500">{abstainPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-slate-500 transition-all duration-500" style={{ width: `${abstainPct}%` }} />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-900/20">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {isActive && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { choice: VOTE_CHOICES.FOR,     label: '✓ For',     style: { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' } },
              { choice: VOTE_CHOICES.AGAINST, label: '✗ Against', style: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' } },
              { choice: VOTE_CHOICES.ABSTAIN, label: '◌ Abstain', style: { background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8' } },
            ].map(({ choice, label, style }) => (
              <button key={choice} onClick={() => handleVote(choice)} disabled={voting}
                className="py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
                style={style}>
                {voting ? '...' : label}
              </button>
            ))}
          </div>
        )}

        {canFinalize && (
          <button onClick={handleFinalize}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
            Finalize Proposal
          </button>
        )}

        {canExecute && (
          <button onClick={handleExecute}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
            ⚡ Execute Proposal (+5 Rep)
          </button>
        )}

        {proposal.status === 4 && now < proposal.executionTime && (
          <div className="w-full p-3 rounded-xl text-center text-xs text-amber-300/70 border border-amber-500/20"
            style={{ background: 'rgba(245,158,11,0.05)' }}>
            Executable after: {new Date(proposal.executionTime * 1000).toLocaleString()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <p className="text-slate-600 text-xs font-mono">
          By: <span className="text-slate-500">{isOwn ? 'You' : shortAddr(proposal.proposer)}</span>
        </p>
        {proposal.ipfsHash && (
          <span className="text-xs text-slate-600">📦 IPFS</span>
        )}
      </div>
    </div>
  );
};

export default ProposalCard;