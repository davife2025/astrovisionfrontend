// src/components/AdminPanel.jsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme1.css';

const AdminPanel = ({ contractAddress, ownerAddress }) => {
  const { account, provider } = useWallet();
  
  const [researcherAddr, setResearcherAddr] = useState('');
  const [reputationAddr, setReputationAddr] = useState('');
  const [reputationAmount, setReputationAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOwner = account?.toLowerCase() === ownerAddress?.toLowerCase();

  const handleSetVerifiedResearcher = async (verified) => {
    if (!ethers.isAddress(researcherAddr)) {
      setError('Invalid address');
      return;
    }
    if (!provider) {
      setError('Wallet not connected');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.setVerifiedResearcher(researcherAddr, verified);
      await tx.wait();
      alert(`Researcher ${verified ? 'verified' : 'unverified'}!`);
      setResearcherAddr('');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else if (err.message.includes('Ownable')) setError('Only owner can perform this action');
      else setError(err.message || 'Failed to update researcher status');
    } finally {
      setLoading(false);
    }
  };

  const handleAwardReputation = async () => {
    if (!ethers.isAddress(reputationAddr)) {
      setError('Invalid address');
      return;
    }
    if (!reputationAmount || isNaN(reputationAmount) || Number(reputationAmount) <= 0) {
      setError('Invalid reputation amount');
      return;
    }
    if (!provider) {
      setError('Wallet not connected');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.awardReputation(reputationAddr, reputationAmount);
      await tx.wait();
      alert(`Awarded ${reputationAmount} reputation!`);
      setReputationAddr('');
      setReputationAmount('');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else if (err.message.includes('Ownable')) setError('Only owner can award reputation');
      else setError(err.message || 'Failed to award reputation');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!provider) return;
    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.pause();
      await tx.wait();
      alert('⚠️ Contract PAUSED - all governance actions are frozen');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else setError(err.message || 'Failed to pause');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpause = async () => {
    if (!provider) return;
    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.unpause();
      await tx.wait();
      alert('✅ Contract UNPAUSED - governance resumed');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else setError(err.message || 'Failed to unpause');
    } finally {
      setLoading(false);
    }
  };

  const handleIncrementWeek = async () => {
    if (!provider) return;
  if (!window.confirm('Increment week number and reset active weekly theme?')) return;
    
    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.incrementWeek();
      await tx.wait();
      alert('Week incremented! Active theme cleared.');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else setError(err.message || 'Failed to increment week');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!provider) return;
  if (!window.confirm('⚠️ EMERGENCY WITHDRAW - Are you sure? This action withdraws all contract funds to the owner.')) return;
    
    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.emergencyWithdraw();
      await tx.wait();
      alert('Emergency withdrawal complete');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else setError(err.message || 'Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="dao-stat-card access-denied-card">
        <div className="access-denied-icon">🔒</div>
        <h3 className="access-denied-title">Admin Access Required</h3>
        <p className="access-denied-message">
          Only the contract owner can access this panel
        </p>
      </div>
    );
  }

  return (
    <div className="mb-32">
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">
          <span>⚙️</span>
          Admin Panel
        </h2>
        <p className="section-subtitle">
          Owner-only governance controls
        </p>
      </div>

      {error && (
        <div className="alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* Verified Researcher Management */}
      <div className="dao-stat-card mb-20">
        <h3 className="dao-heading-tertiary">
          <span>🎓</span> Verified Researcher Badge
        </h3>
        <p className="dao-text-small mb-16">
          Grant or revoke verified researcher status for community members
        </p>
        
        <input
          type="text"
          className="cpf-input mb-12"
          value={researcherAddr}
          onChange={e => setResearcherAddr(e.target.value)}
          placeholder="0x... researcher address"
          disabled={loading}
        />

        <div className="form-grid-2col">
          <button
            onClick={() => handleSetVerifiedResearcher(true)}
            disabled={loading || !researcherAddr}
            className="button-success"
          >
            ✓ Verify
          </button>
          <button
            onClick={() => handleSetVerifiedResearcher(false)}
            disabled={loading || !researcherAddr}
            className="button-danger"
          >
            ✗ Revoke
          </button>
        </div>
      </div>

      {/* Award Reputation */}
      <div className="dao-stat-card mb-20">
        <h3 className="dao-heading-tertiary">
          <span>⭐</span> Award Reputation
        </h3>
        <p className="dao-text-small mb-16">
          Manually grant reputation to active community members
        </p>
        
        <input
          type="text"
          className="cpf-input mb-12"
          value={reputationAddr}
          onChange={e => setReputationAddr(e.target.value)}
          placeholder="0x... recipient address"
          disabled={loading}
        />

        <input
          type="number"
          className="cpf-input mb-12"
          value={reputationAmount}
          onChange={e => setReputationAmount(e.target.value)}
          placeholder="Reputation amount (1-1000)"
          min="1"
          max="1000"
          disabled={loading}
        />

        <button
          onClick={handleAwardReputation}
          disabled={loading || !reputationAddr || !reputationAmount}
          className="submit-button-primary w-full"
        >
          {loading ? 'Processing...' : '🎁 Award Reputation'}
        </button>
      </div>

      {/* Contract Controls */}
      <div className="dao-stat-card mb-20">
        <h3 className="dao-heading-tertiary">
          <span>🎛️</span> Contract Controls
        </h3>
        
        <div className="form-grid-2col mb-12">
          <button
            onClick={handlePause}
            disabled={loading}
            className="button-warning"
          >
            ⏸️ Pause
          </button>
          <button
            onClick={handleUnpause}
            disabled={loading}
            className="button-success"
          >
            ▶️ Unpause
          </button>
        </div>

        <button
          onClick={handleIncrementWeek}
          disabled={loading}
          className="button-info w-full mb-12"
        >
          📅 Increment Week
        </button>

        <p className="cpf-hint">
          Advances the week counter and clears the active weekly theme
        </p>
      </div>

      {/* Emergency Controls */}
      <div className="dao-stat-card card-danger">
        <h3 className="dao-heading-tertiary" style={{ color: '#f87171' }}>
          <span>🚨</span> Emergency Controls
        </h3>
        <p className="dao-text-small mb-16" style={{ color: 'rgba(239, 68, 68, 0.7)' }}>
          ⚠️ Use only in critical situations - withdraws all contract funds to owner
        </p>
        
        <button
          onClick={handleEmergencyWithdraw}
          disabled={loading}
          className="button-danger w-full"
          style={{ fontWeight: '700' }}
        >
          🆘 Emergency Withdraw
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;