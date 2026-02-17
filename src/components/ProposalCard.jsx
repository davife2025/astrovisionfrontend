// src/components/ProposalCard.jsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme.css';

const PROPOSAL_TYPE_LABELS = {
  0: 'Weekly Theme', 1: 'Research Discovery',
  2: 'Community Proposal', 3: 'Knowledge Sharing', 4: 'Collaboration',
};

const STATUS_CONFIG = {
  0: { label: 'Pending',   border: 'pc-border-pending',   badge: 'pc-badge-pending',   dot: 'pc-dot-pending'   },
  1: { label: 'Active',    border: 'pc-border-active',    badge: 'pc-badge-active',    dot: 'pc-dot-active'    },
  2: { label: 'Passed',    border: 'pc-border-passed',    badge: 'pc-badge-passed',    dot: 'pc-dot-passed'    },
  3: { label: 'Rejected',  border: 'pc-border-rejected',  badge: 'pc-badge-rejected',  dot: 'pc-dot-rejected'  },
  4: { label: 'Queued',    border: 'pc-border-queued',    badge: 'pc-badge-queued',    dot: 'pc-dot-queued'    },
  5: { label: 'Executed',  border: 'pc-border-executed',  badge: 'pc-badge-executed',  dot: 'pc-dot-executed'  },
  6: { label: 'Cancelled', border: 'pc-border-cancelled', badge: 'pc-badge-cancelled', dot: 'pc-dot-cancelled' },
};

const VOTE_CHOICES = { AGAINST: 0, FOR: 1, ABSTAIN: 2 };

const ProposalCard = ({ proposal, contractAddress, userAddress, onVoteSuccess }) => {
  const { provider } = useWallet(); // ← uses any connected wallet, not window.ethereum
  const [voting, setVoting]     = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleVote = async (choice) => {
    setError('');
    setVoting(true);
    try {
      if (!provider) throw new Error('Wallet not connected');
      if (!contractAddress || contractAddress === '0x...' || !ethers.isAddress(contractAddress))
        throw new Error('Contract address not configured');
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.vote(proposal.id, choice);
      await tx.wait();
      if (onVoteSuccess) onVoteSuccess();
      alert('Vote cast! +1 Reputation earned 🎉');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED')                   setError('Transaction rejected');
      else if (err.message.includes('AlreadyVoted'))        setError('You already voted on this proposal');
      else if (err.message.includes('AlreadyDelegated'))    setError('Cannot vote — voting power is delegated');
      else if (err.message.includes('Voting period ended')) setError('Voting period has ended');
      else                                                   setError(err.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  const handleFinalize = async () => {
    try {
      if (!provider) throw new Error('Wallet not connected');
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
      if (!provider) throw new Error('Wallet not connected');
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.executeProposal(proposal.id);
      await tx.wait();
      if (onVoteSuccess) onVoteSuccess();
      alert('Proposal executed! +5 Reputation earned 🎉');
    } catch (err) { alert('Failed to execute: ' + err.message); }
  };

  const totalVotes  = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const forPct      = totalVotes > 0 ? (proposal.votesFor     / totalVotes * 100).toFixed(1) : 0;
  const againstPct  = totalVotes > 0 ? (proposal.votesAgainst / totalVotes * 100).toFixed(1) : 0;
  const abstainPct  = totalVotes > 0 ? (proposal.votesAbstain / totalVotes * 100).toFixed(1) : 0;
  const now         = Math.floor(Date.now() / 1000);
  const isActive    = proposal.status === 1 && now <= proposal.endTime;
  const canFinalize = proposal.status === 1 && now > proposal.endTime;
  const canExecute  = proposal.status === 4 && now >= proposal.executionTime;
  const statusCfg   = STATUS_CONFIG[proposal.status] || STATUS_CONFIG[0];
  const isOwn       = proposal.proposer?.toLowerCase() === userAddress?.toLowerCase();
  const shortAddr   = (a) => `${a?.slice(0, 6)}...${a?.slice(-4)}`;

  return (
    <div className={`pc-card ${statusCfg.border}`}>

      <div className="pc-body">

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom:'10px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
              <span className={`pc-type-label pc-type-${proposal.proposalType}`}>
                {PROPOSAL_TYPE_LABELS[proposal.proposalType]}
              </span>
              <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'12px' }}>·</span>
              <span style={{ fontFamily:'monospace', fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>
                #{proposal.id}
              </span>
              {isOwn && <span className="pc-own-tag">Your proposal</span>}
            </div>
            <p className="pc-title">{proposal.title}</p>
          </div>

          <div className={`pc-badge ${statusCfg.badge}`}>
            <span className={`pc-dot ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom:'14px' }}>
          <p className={`pc-description ${expanded ? '' : 'collapsed'}`}>{proposal.description}</p>
          {proposal.description?.length > 120 && (
            <button className="pc-expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show less ↑' : 'Read more ↓'}
            </button>
          )}
        </div>

        {/* IPFS */}
        {proposal.ipfsHash && (
          <a href={proposal.ipfsHash} target="_blank" rel="noopener noreferrer"
            className="pc-ipfs-link" style={{ marginBottom:'14px', display:'inline-flex' }}>
            📄 Supporting documents →
          </a>
        )}

        {/* Vote stats */}
        <div style={{ marginBottom:'14px' }}>
          <div className="pc-stats-header">
            <span>{totalVotes} total votes</span>
            <span>
              {isActive
                ? `Ends ${new Date(proposal.endTime * 1000).toLocaleDateString()}`
                : `Ended ${new Date(proposal.endTime * 1000).toLocaleDateString()}`}
            </span>
          </div>

          {[
            { label:`✓ For — ${proposal.votesFor}`,         pct:forPct,     lc:'pc-stat-for',     bc:'pc-bar-for'     },
            { label:`✗ Against — ${proposal.votesAgainst}`, pct:againstPct, lc:'pc-stat-against', bc:'pc-bar-against' },
            { label:`◌ Abstain — ${proposal.votesAbstain}`, pct:abstainPct, lc:'pc-stat-abstain', bc:'pc-bar-abstain' },
          ].map(({ label, pct, lc, bc }) => (
            <div key={label} style={{ marginBottom:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                <span className={lc}>{label}</span>
                <span className="pc-stat-pct">{pct}%</span>
              </div>
              <div className="pc-bar-track">
                <div className={bc} style={{ width:`${pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div className="pc-error">⚠️ {error}</div>}

        {/* Vote buttons */}
        {isActive && (
          <div className="pc-vote-grid">
            {[
              { choice:VOTE_CHOICES.FOR,     label:'✓ For',     cls:'pc-vote-for'     },
              { choice:VOTE_CHOICES.AGAINST, label:'✗ Against', cls:'pc-vote-against' },
              { choice:VOTE_CHOICES.ABSTAIN, label:'◌ Abstain', cls:'pc-vote-abstain' },
            ].map(({ choice, label, cls }) => (
              <button key={choice} className={`pc-vote-btn ${cls}`}
                onClick={() => handleVote(choice)} disabled={voting}>
                {voting ? '...' : label}
              </button>
            ))}
          </div>
        )}

        {canFinalize && (
          <button className="pc-btn-finalize" onClick={handleFinalize}>Finalize Proposal</button>
        )}

        {canExecute && (
          <button className="pc-btn-execute" onClick={handleExecute}>⚡ Execute Proposal (+5 Rep)</button>
        )}

        {proposal.status === 4 && now < proposal.executionTime && (
          <div className="pc-waiting">
            Executable after: {new Date(proposal.executionTime * 1000).toLocaleString()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pc-footer">
        <span className="pc-footer-addr">By: {isOwn ? 'You' : shortAddr(proposal.proposer)}</span>
        {proposal.ipfsHash && <span className="pc-footer-ipfs">📦 IPFS</span>}
      </div>
    </div>
  );
};

export default ProposalCard;