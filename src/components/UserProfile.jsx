// src/components/UserProfile.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import './dao-components-glass.css';

const UserProfile = ({ contractAddress, userAddress }) => {
  const [reputation, setReputation]       = useState(0);
  const [voteCount, setVoteCount]         = useState(0);
  const [delegate, setDelegate]           = useState('');
  const [delegateInput, setDelegateInput] = useState('');
  const [loading, setLoading]             = useState(false);

  const loadUserData = useCallback(async () => {
    if (!userAddress) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const [rep, votes, delegateAddr] = await Promise.all([
        contract.userReputation(userAddress),
        contract.userVoteCount(userAddress),
        contract.delegates(userAddress),
      ]);
      setReputation(Number(rep));
      setVoteCount(Number(votes));
      setDelegate(delegateAddr === ethers.ZeroAddress ? '' : delegateAddr);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }, [userAddress, contractAddress]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const handleDelegate = async () => {
    if (!delegateInput.trim())          { alert('Please enter a delegate address'); return; }
    if (!ethers.isAddress(delegateInput)) { alert('Invalid Ethereum address'); return; }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.delegate(delegateInput);
      await tx.wait();
      setDelegate(delegateInput);
      setDelegateInput('');
      alert('Voting power delegated successfully!');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED')                       alert('Transaction rejected');
      else if (err.message.includes('Cannot delegate to self')) alert('You cannot delegate to yourself');
      else                                                       alert('Failed to delegate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUndelegate = async () => {
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.undelegate();
      await tx.wait();
      setDelegate('');
      alert('Delegation removed successfully!');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED')               alert('Transaction rejected');
      else if (err.message.includes('Not delegating'))  alert('You are not currently delegating');
      else                                               alert('Failed to undelegate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reputationPercent = Math.min((reputation / 10000) * 100, 100).toFixed(1);
  const shortAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

  return (
    <div className="up-container">

      <h2 className="up-title">👤 Your Profile</h2>

      {/* Reputation bar */}
      <div style={{ marginBottom:'20px' }}>
        <div className="up-rep-header">
          <span className="up-rep-label">Reputation</span>
          <span className="up-rep-value">{reputation.toLocaleString()} / 10,000</span>
        </div>
        <div className="up-bar-track">
          <div className="up-bar-fill" style={{ width:`${reputationPercent}%` }} />
        </div>
        <p className="up-rep-pct">{reputationPercent}% of maximum</p>
      </div>

      {/* Stats */}
      <div className="up-stats-grid">
        <div className="up-stat-card up-stat-votes">
          <p className="up-stat-label-votes">Votes Cast</p>
          <p className="up-stat-val-votes">{voteCount}</p>
        </div>
        <div className="up-stat-card up-stat-rep">
          <p className="up-stat-label-rep">Reputation</p>
          <p className="up-stat-val-rep">{reputation}</p>
        </div>
      </div>

      <hr className="up-divider" />

      {/* Delegation */}
      <h3 className="up-section-title">🔗 Voting Delegation</h3>

      {delegate ? (
        <div className="up-delegate-active">
          <p className="up-delegate-warn">⚠️ Your voting power is delegated to:</p>
          <p className="up-delegate-addr">{shortAddr(delegate)}</p>
          <p className="up-delegate-note">
            You cannot vote while delegating. Undelegate to vote yourself.
          </p>
          <button className="up-btn-undelegate" onClick={handleUndelegate} disabled={loading}>
            {loading ? 'Processing...' : 'Remove Delegation'}
          </button>
        </div>
      ) : (
        <div>
          <p className="up-delegate-info">
            Delegate your voting power to another address. They can vote on your behalf.
          </p>
          <input type="text" className="up-input"
            value={delegateInput}
            onChange={e => setDelegateInput(e.target.value)}
            placeholder="0x... delegate address"
            disabled={loading} />
          <button className="up-btn-delegate" onClick={handleDelegate}
            disabled={loading || !delegateInput}>
            {loading ? 'Processing...' : 'Delegate Voting Power'}
          </button>
        </div>
      )}

      {/* Earn reputation info */}
      <div className="up-earn-box">
        <p className="up-earn-title">How to Earn Reputation</p>
        {[
          'Vote on proposals: +1 reputation',
          'Execute proposals: +5 reputation',
          'Create proposals: earn when executed',
          'Active participation: awarded by admin',
          'Maximum: 10,000 reputation',
        ].map(item => (
          <p key={item} className="up-earn-item">· {item}</p>
        ))}
      </div>

    </div>
  );
};

export default UserProfile;