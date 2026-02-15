// src/components/CreateProposalForm.jsx
// FIXED: Added modal wrapper with onClose functionality

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';

const PROPOSAL_TYPES = [
  { value: '0', label: '🌟 Weekly Theme',       description: 'Set this week\'s exploration theme', quickVote: true  },
  { value: '1', label: '🔭 Research Discovery', description: 'Share a scientific finding',          quickVote: false },
  { value: '2', label: '🌍 Community Proposal', description: 'Suggest a community initiative',      quickVote: false },
  { value: '3', label: '📚 Knowledge Sharing',  description: 'Share educational content',           quickVote: false },
  { value: '4', label: '🤝 Collaboration',       description: 'Propose a collaboration project',     quickVote: false },
];

const CreateProposalForm = ({ contractAddress, userReputation, onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    type: '0', title: '', description: '', ipfsHash: '', quickVote: true,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleTypeChange = (e) => {
    const t = PROPOSAL_TYPES.find(p => p.value === e.target.value);
    setFormData({ ...formData, type: e.target.value, quickVote: t?.quickVote || false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim())       { setError('Title is required'); return; }
    if (!formData.description.trim()) { setError('Description is required'); return; }
    if (userReputation < 3)           { setError('You need at least 3 reputation to create proposals'); return; }
    if (!contractAddress || contractAddress === '0x...' || !ethers.isAddress(contractAddress)) {
      setError('Contract address is not configured. Add REACT_APP_DAO_CONTRACT_ADDRESS to your .env file.');
      return;
    }

    try {
      setLoading(true);
      if (!window.ethereum) throw new Error('MetaMask not installed');

      console.log('🚀 Creating proposal...');
      console.log('Contract:', contractAddress);
      console.log('Form data:', formData);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      console.log('📝 Calling createProposal on contract...');
      const tx = await contract.createProposal(
        parseInt(formData.type),
        formData.title,
        formData.description,
        formData.ipfsHash || '',
        formData.quickVote,
      );

      console.log('⏳ Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed!', receipt);

      setFormData({ type: '0', title: '', description: '', ipfsHash: '', quickVote: true });
      if (onSuccess) onSuccess();
      alert('✅ Proposal Created!\n\nTransaction confirmed on-chain.');
    } catch (err) {
      console.error('❌ Error creating proposal:', err);
      if (err.code === 'ACTION_REJECTED')                         setError('Transaction rejected by user');
      else if (err.message.includes('InsufficientReputation'))    setError('You need at least 3 reputation');
      else                                                         setError(err.message || 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50";
  const labelClass = "block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2";

  return (
    // Modal overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: 'rgba(15,23,42,0.95)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header with close button */}
        <div className="sticky top-0 px-6 py-5 border-b border-white/10 flex items-center justify-between"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          <div>
            <h2 className="text-xl font-bold text-white">Create Proposal</h2>
            <p className="text-slate-400 text-sm mt-1">Submit for community governance</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-900/20 flex items-start gap-2">
              <span className="text-red-400 mt-0.5">⚠️</span>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Reputation warning */}
          {userReputation < 3 && (
            <div className="mb-5 p-4 rounded-xl border border-amber-500/25 bg-amber-900/10">
              <p className="text-amber-300 text-sm">
                You need <strong>3 reputation</strong> to create proposals. Current: <strong>{userReputation}</strong>
              </p>
              <p className="text-amber-400/60 text-xs mt-1">Vote on proposals to earn reputation.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Proposal type */}
            <div>
              <label className={labelClass}>Proposal Type</label>
              <div className="grid grid-cols-1 gap-2">
                {PROPOSAL_TYPES.map(type => (
                  <label key={type.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.type === type.value
                        ? 'border-indigo-500/50 bg-indigo-900/20'
                        : 'border-white/5 bg-white/3 hover:border-white/15'
                    }`}>
                    <input type="radio" name="proposalType" value={type.value}
                      checked={formData.type === type.value} onChange={handleTypeChange}
                      className="accent-indigo-500" disabled={loading} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{type.label}</p>
                      <p className="text-slate-500 text-xs">{type.description}</p>
                    </div>
                    {type.quickVote && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-500/30">
                        3 days
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className={labelClass}>Title <span className="text-red-400 normal-case">*</span></label>
              <input type="text" value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter a clear, descriptive title"
                className={inputClass} disabled={loading} required />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description <span className="text-red-400 normal-case">*</span></label>
              <textarea value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your proposal in detail..."
                rows={5} className={inputClass} disabled={loading} required />
            </div>

            {/* IPFS Hash */}
            <div>
              <label className={labelClass}>IPFS Hash <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
              <input type="text" value={formData.ipfsHash}
                onChange={e => setFormData({ ...formData, ipfsHash: e.target.value })}
                placeholder="ipfs://Qm..."
                className={inputClass} disabled={loading} />
              <p className="mt-1.5 text-slate-600 text-xs">Upload documents to IPFS and paste hash</p>
            </div>

            {/* Quick vote toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <p className="text-white text-sm font-medium">Quick Vote</p>
                <p className="text-slate-500 text-xs mt-0.5">3 day period instead of 7 days</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.quickVote}
                  onChange={e => setFormData({ ...formData, quickVote: e.target.checked })}
                  className="sr-only peer" disabled={loading} />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading || userReputation < 3}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: loading || userReputation < 3 ? '#374151' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Submitting to blockchain...
                </span>
              ) : 'Create Proposal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProposalForm;