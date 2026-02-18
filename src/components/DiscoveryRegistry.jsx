// src/components/DiscoveryRegistry.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme1.css';

const DiscoveryRegistry = ({ contractAddress }) => {
  const { provider } = useWallet();
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, verified, pending

  const loadDiscoveries = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const discoveryProposalIds = await contract.discoveryProposals();
      
      const discoveryList = [];
      for (let i = 0; i < discoveryProposalIds.length; i++) {
        try {
          const propId = Number(discoveryProposalIds[i]);
          const disc = await contract.discoveries(propId);
          const prop = await contract.getProposal(propId);
          
          discoveryList.push({
            proposalId: propId,
            title: disc[1],
            researcherName: disc[2],
            institution: disc[3],
            paperIPFS: disc[4],
            tags: disc[5],
            votingScore: Number(disc[6]),
            timestamp: Number(disc[7]),
            verified: disc[8],
            approvalCount: Number(disc[9]),
            proposer: prop[1],
            description: prop[4],
            status: Number(prop[11]),
          });
        } catch (err) {
          console.warn(`Skipping discovery ${i}:`, err.message);
        }
      }
      
      setDiscoveries(discoveryList.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load discoveries:', error);
    } finally {
      setLoading(false);
    }
  }, [provider, contractAddress]);

  useEffect(() => {
    loadDiscoveries();
  }, [loadDiscoveries]);

  const filteredDiscoveries = discoveries.filter(d => {
    if (filter === 'verified') return d.verified;
    if (filter === 'pending') return !d.verified;
    return true;
  });

  if (loading) {
    return (
      <div className="dao-stat-card">
        <div className="flex-center gap-12 p-20">
          <div className="spinner-glass" />
          <p className="dao-text-dim">Loading discoveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-32">
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">
          <span>🔬</span>
          Discovery Registry
        </h2>
        <p className="section-subtitle">
          Research findings submitted by the community
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex-center gap-12 mb-20" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
        >
          All Discoveries <span className="opacity-60">({discoveries.length})</span>
        </button>
        <button
          onClick={() => setFilter('verified')}
          className={`filter-tab ${filter === 'verified' ? 'active' : ''}`}
        >
          ✓ Verified <span className="opacity-60">({discoveries.filter(d => d.verified).length})</span>
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
        >
          ⏳ Pending <span className="opacity-60">({discoveries.filter(d => !d.verified).length})</span>
        </button>
      </div>

      {/* Empty state */}
      {filteredDiscoveries.length === 0 && (
        <div className="dao-stat-card empty-state">
          <div className="empty-state-icon">🔭</div>
          <h3 className="empty-state-title">
            No {filter === 'all' ? '' : filter} discoveries yet
          </h3>
          <p className="empty-state-message">
            {filter === 'all' 
              ? 'Create a "Research Discovery" proposal to submit your findings'
              : `No ${filter} discoveries found`}
          </p>
        </div>
      )}

      {/* Discovery cards */}
      <div className="flex-col gap-16">
        {filteredDiscoveries.map(disc => (
          <div
            key={disc.proposalId}
            className={`dao-stat-card ${disc.verified ? 'card-success' : 'card-warning'}`}
          >
            {/* Header */}
            <div className="flex-between gap-12 mb-12">
              <div className="flex-col gap-8" style={{ flex: 1 }}>
                <div className="flex-center gap-8" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  <span className={disc.verified ? 'badge-verified' : 'badge-pending'}>
                    {disc.verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                  <span className="dao-text-mono">
                    #{disc.proposalId}
                  </span>
                </div>
                <h3 className="dao-heading-secondary">
                  {disc.title}
                </h3>
              </div>
              <div style={{ fontSize: '32px' }}>🧬</div>
            </div>

            {/* Researcher info */}
            <div className="stats-grid-compact mb-12">
              <div>
                <p className="data-label">Researcher</p>
                <p className="dao-text-small" style={{ fontWeight: '600' }}>
                  {disc.researcherName || 'Anonymous'}
                </p>
              </div>
              <div>
                <p className="data-label">Institution</p>
                <p className="dao-text-small" style={{ fontWeight: '600' }}>
                  {disc.institution || 'Independent'}
                </p>
              </div>
              <div>
                <p className="data-label">Date</p>
                <p className="dao-text-small" style={{ fontWeight: '600' }}>
                  {new Date(disc.timestamp * 1000).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="data-label">Approvals</p>
                <p className="dao-text-small" style={{ fontWeight: '600' }}>
                  {disc.approvalCount}
                </p>
              </div>
            </div>

            {/* Description */}
            {disc.description && (
              <p className="dao-text-small mb-12">
                {disc.description.length > 200 
                  ? `${disc.description.substring(0, 200)}...` 
                  : disc.description}
              </p>
            )}

            {/* Tags */}
            {disc.tags && disc.tags.length > 0 && (
              <div className="flex-center gap-8 mb-12" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {disc.tags.slice(0, 5).map((tag, i) => (
                  <span key={i} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Paper link */}
            {disc.paperIPFS && (
              <a
                href={disc.paperIPFS.startsWith('ipfs://') ? disc.paperIPFS : `ipfs://${disc.paperIPFS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-primary"
              >
                📄 View Research Paper →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscoveryRegistry;