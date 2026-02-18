// src/components/GovernanceSettings.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme1.css';

const GovernanceSettings = ({ contractAddress, ownerAddress }) => {
  const { account, provider } = useWallet();
  
  const [currentSettings, setCurrentSettings] = useState({
    votingPeriod: 0,
    quickVotePeriod: 0,
    executionDelay: 0,
    proposalThreshold: 0,
    quorumPercentage: 0,
  });

  const [newSettings, setNewSettings] = useState({
    votingPeriod: '',
    quickVotePeriod: '',
    executionDelay: '',
    proposalThreshold: '',
    quorumPercentage: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOwner = account?.toLowerCase() === ownerAddress?.toLowerCase();

  const loadCurrentSettings = useCallback(async () => {
    if (!provider) return;
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const [votingPeriod, quickVotePeriod, executionDelay, proposalThreshold, quorumPercentage] = await Promise.all([
        contract.votingPeriod(),
        contract.quickVotePeriod(),
        contract.executionDelay(),
        contract.proposalThreshold(),
        contract.quorumPercentage(),
      ]);

      setCurrentSettings({
        votingPeriod: Number(votingPeriod),
        quickVotePeriod: Number(quickVotePeriod),
        executionDelay: Number(executionDelay),
        proposalThreshold: Number(proposalThreshold),
        quorumPercentage: Number(quorumPercentage),
      });
    } catch (err) {
      console.error('Failed to load governance settings:', err);
    }
  }, [provider, contractAddress]);

  useEffect(() => {
    loadCurrentSettings();
  }, [loadCurrentSettings]);

  const handleUpdate = async () => {
    if (!provider) {
      setError('Wallet not connected');
      return;
    }

    const votingPeriod = newSettings.votingPeriod || currentSettings.votingPeriod;
    const quickVotePeriod = newSettings.quickVotePeriod || currentSettings.quickVotePeriod;
    const executionDelay = newSettings.executionDelay || currentSettings.executionDelay;
    const proposalThreshold = newSettings.proposalThreshold || currentSettings.proposalThreshold;
    const quorumPercentage = newSettings.quorumPercentage || currentSettings.quorumPercentage;

    // Validation
    if (Number(votingPeriod) < 3600 * 24) {
      setError('Voting period must be at least 1 day (86400 seconds)');
      return;
    }
    if (Number(quickVotePeriod) < 3600 * 12) {
      setError('Quick vote period must be at least 12 hours');
      return;
    }
    if (Number(executionDelay) < 3600 * 24) {
      setError('Execution delay must be at least 1 day');
      return;
    }
    if (Number(quorumPercentage) < 1 || Number(quorumPercentage) > 100) {
      setError('Quorum percentage must be between 1 and 100');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      const tx = await contract.updateGovernanceParams(
        votingPeriod,
        quickVotePeriod,
        executionDelay,
        proposalThreshold,
        quorumPercentage
      );
      await tx.wait();
      
      alert('✅ Governance parameters updated!');
      loadCurrentSettings();
      setNewSettings({
        votingPeriod: '',
        quickVotePeriod: '',
        executionDelay: '',
        proposalThreshold: '',
        quorumPercentage: '',
      });
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') setError('Transaction rejected');
      else if (err.message.includes('Ownable')) setError('Only owner can update governance settings');
      else setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const secondsToDays = (seconds) => (seconds / (3600 * 24)).toFixed(1);

  if (!isOwner) {
    return (
      <div className="dao-stat-card access-denied-card">
        <div className="access-denied-icon">🔒</div>
        <h3 className="access-denied-title">Admin Access Required</h3>
        <p className="access-denied-message">
          Only the contract owner can modify governance parameters
        </p>
      </div>
    );
  }

  return (
    <div className="mb-32">
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">
          <span>⚖️</span>
          Governance Settings
        </h2>
        <p className="section-subtitle">
          Update voting periods, thresholds, and quorum requirements
        </p>
      </div>

      {error && (
        <div className="alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* Current Settings Display */}
      <div className="dao-stat-card mb-20">
        <h3 className="dao-heading-tertiary">
          <span>📊</span>
          Current Parameters
        </h3>
        
        <div className="stats-grid">
          <div>
            <p className="data-label">Voting Period</p>
            <p className="data-value">
              {secondsToDays(currentSettings.votingPeriod)} days
            </p>
            <p className="data-subtitle">
              {currentSettings.votingPeriod.toLocaleString()}s
            </p>
          </div>

          <div>
            <p className="data-label">Quick Vote Period</p>
            <p className="data-value">
              {secondsToDays(currentSettings.quickVotePeriod)} days
            </p>
            <p className="data-subtitle">
              {currentSettings.quickVotePeriod.toLocaleString()}s
            </p>
          </div>

          <div>
            <p className="data-label">Execution Delay</p>
            <p className="data-value">
              {secondsToDays(currentSettings.executionDelay)} days
            </p>
            <p className="data-subtitle">
              {currentSettings.executionDelay.toLocaleString()}s
            </p>
          </div>

          <div>
            <p className="data-label">Proposal Threshold</p>
            <p className="data-value">
              {currentSettings.proposalThreshold} reputation
            </p>
          </div>

          <div>
            <p className="data-label">Quorum Required</p>
            <p className="data-value">
              {currentSettings.quorumPercentage}% of voters
            </p>
          </div>
        </div>
      </div>

      {/* Update Form */}
      <div className="dao-stat-card">
        <h3 className="dao-heading-tertiary">
          <span>✏️</span>
          Update Parameters
        </h3>
        <p className="dao-text-small mb-16">
          Leave fields empty to keep current values. Changes apply to all future proposals.
        </p>

        <div className="flex-col gap-16">
          {/* Voting Period */}
          <div>
            <label className="cpf-label">
              Voting Period (seconds)
            </label>
            <input
              type="number"
              className="cpf-input"
              value={newSettings.votingPeriod}
              onChange={e => setNewSettings(p => ({ ...p, votingPeriod: e.target.value }))}
              placeholder={`Current: ${currentSettings.votingPeriod} (${secondsToDays(currentSettings.votingPeriod)} days)`}
              disabled={loading}
              min="86400"
            />
            <p className="cpf-hint">Minimum: 86400 (1 day). Standard voting period.</p>
          </div>

          {/* Quick Vote Period */}
          <div>
            <label className="cpf-label">
              Quick Vote Period (seconds)
            </label>
            <input
              type="number"
              className="cpf-input"
              value={newSettings.quickVotePeriod}
              onChange={e => setNewSettings(p => ({ ...p, quickVotePeriod: e.target.value }))}
              placeholder={`Current: ${currentSettings.quickVotePeriod} (${secondsToDays(currentSettings.quickVotePeriod)} days)`}
              disabled={loading}
              min="43200"
            />
            <p className="cpf-hint">Minimum: 43200 (12 hours). For time-sensitive proposals.</p>
          </div>

          {/* Execution Delay */}
          <div>
            <label className="cpf-label">
              Execution Delay (seconds)
            </label>
            <input
              type="number"
              className="cpf-input"
              value={newSettings.executionDelay}
              onChange={e => setNewSettings(p => ({ ...p, executionDelay: e.target.value }))}
              placeholder={`Current: ${currentSettings.executionDelay} (${secondsToDays(currentSettings.executionDelay)} days)`}
              disabled={loading}
              min="86400"
            />
            <p className="cpf-hint">Timelock delay between finalization and execution. Minimum: 86400 (1 day).</p>
          </div>

          {/* Proposal Threshold */}
          <div>
            <label className="cpf-label">
              Proposal Threshold (reputation)
            </label>
            <input
              type="number"
              className="cpf-input"
              value={newSettings.proposalThreshold}
              onChange={e => setNewSettings(p => ({ ...p, proposalThreshold: e.target.value }))}
              placeholder={`Current: ${currentSettings.proposalThreshold}`}
              disabled={loading}
              min="0"
              max="10000"
            />
            <p className="cpf-hint">Minimum reputation required to create proposals.</p>
          </div>

          {/* Quorum Percentage */}
          <div>
            <label className="cpf-label">
              Quorum Percentage
            </label>
            <input
              type="number"
              className="cpf-input"
              value={newSettings.quorumPercentage}
              onChange={e => setNewSettings(p => ({ ...p, quorumPercentage: e.target.value }))}
              placeholder={`Current: ${currentSettings.quorumPercentage}%`}
              disabled={loading}
              min="1"
              max="100"
            />
            <p className="cpf-hint">Percentage of registered voters required for quorum (1-100).</p>
          </div>

          {/* Submit */}
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="submit-button-primary mt-8"
          >
            {loading ? (
              <span className="flex-center gap-8">
                <div className="spinner-glass" />
                Updating...
              </span>
            ) : '💾 Update Governance Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceSettings;