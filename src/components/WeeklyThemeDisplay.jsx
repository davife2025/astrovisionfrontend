// src/components/WeeklyThemeDisplay.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme1.css';

const WeeklyThemeDisplay = ({ contractAddress }) => {
  const { provider } = useWallet();
  const [theme, setTheme] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadActiveTheme = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      
      // Get active weekly theme proposal ID
      const activeThemeId = await contract.activeWeeklyTheme();
      
      if (Number(activeThemeId) === 0) {
        setTheme(null);
        setProposal(null);
        setLoading(false);
        return;
      }

      // Get theme data
      const themeData = await contract.weeklyThemes(activeThemeId);
      const proposalData = await contract.getProposal(activeThemeId);

      setTheme({
        proposalId: Number(activeThemeId),
        themeName: themeData[1],
        description: themeData[2],
        weekNumber: Number(themeData[3]),
        votingScore: Number(themeData[4]),
        isActive: themeData[5],
      });

      setProposal({
        id: Number(proposalData[0]),
        title: proposalData[3],
        description: proposalData[4],
        votesFor: Number(proposalData[6]),
        votesAgainst: Number(proposalData[7]),
      });
    } catch (error) {
      console.error('Failed to load weekly theme:', error);
      setTheme(null);
    } finally {
      setLoading(false);
    }
  }, [provider, contractAddress]);

  useEffect(() => {
    loadActiveTheme();
  }, [loadActiveTheme]);

  if (loading) {
    return (
      <div className="dao-stat-card card-warning">
        <div className="flex-center gap-12">
          <div className="spinner-glass" />
          <p className="dao-text-dim">Loading weekly theme...</p>
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="dao-stat-card">
        <div className="flex-center gap-12 mb-8" style={{ justifyContent: 'flex-start' }}>
          <span style={{ fontSize: '24px' }}>🌟</span>
          <p className="dao-text-dim" style={{ fontWeight: '600' }}>
            No Active Weekly Theme
          </p>
        </div>
        <p className="dao-text-small" style={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: '1.6' }}>
          Create a "Weekly Theme" proposal and pass it through governance to set the community's research focus.
        </p>
      </div>
    );
  }

  return (
    <div className="dao-stat-card card-active-theme">
      {/* Badge */}
      <div className="flex-between mb-12">
        <div className="badge-active">
          <span>🌟</span>
          <span>Week {theme.weekNumber}</span>
        </div>
        <span className="dao-text-mono">
          #{theme.proposalId}
        </span>
      </div>

      {/* Theme name */}
      <h3 className="dao-heading-secondary mb-8">
        {proposal?.title || theme.themeName}
      </h3>

      {/* Description */}
      {proposal?.description && (
        <p className="dao-text-small mb-12">
          {proposal.description.length > 140 
            ? `${proposal.description.substring(0, 140)}...` 
            : proposal.description}
        </p>
      )}

      {/* Vote stats */}
      {proposal && (
        <div className="form-grid-2col data-row mb-12">
          <div>
            <p className="data-label">Community Support</p>
            <p className="data-value" style={{ color: '#86efac' }}>
              ✓ {proposal.votesFor}
            </p>
          </div>
          <div>
            <p className="data-label">Against</p>
            <p className="data-value" style={{ color: '#fca5a5' }}>
              ✗ {proposal.votesAgainst}
            </p>
          </div>
        </div>
      )}

      {/* Active indicator */}
      <div className="divider" />
      <div className="flex-center gap-8 mt-12" style={{ justifyContent: 'flex-start' }}>
        <div className="pulse-dot" />
        <span className="dao-text-tiny" style={{ color: '#86efac', fontWeight: '500' }}>
          Active Research Theme
        </span>
      </div>
    </div>
  );
};

export default WeeklyThemeDisplay;