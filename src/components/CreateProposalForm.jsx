// src/components/CreateProposalForm.jsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import { useWallet } from '../context/WalletContext';
import './dao-glass-theme.css';

const PROPOSAL_TYPES = [
  { value:'0', label:'🌟 Weekly Theme',       description:"Set this week's exploration theme", quickVote:true  },
  { value:'1', label:'🔭 Research Discovery', description:'Share a scientific finding',          quickVote:false },
  { value:'2', label:'🌍 Community Proposal', description:'Suggest a community initiative',      quickVote:false },
  { value:'3', label:'📚 Knowledge Sharing',  description:'Share educational content',           quickVote:false },
  { value:'4', label:'🤝 Collaboration',       description:'Propose a collaboration project',    quickVote:false },
];

const CreateProposalForm = ({ contractAddress, userReputation, onSuccess, onClose }) => {
  const { provider } = useWallet(); // ← uses any connected wallet, not window.ethereum

  const [formData, setFormData] = useState({
    type:'0', title:'', description:'', ipfsHash:'', quickVote:true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleTypeChange = (val) => {
    const t = PROPOSAL_TYPES.find(p => p.value === val);
    setFormData(prev => ({ ...prev, type:val, quickVote: t?.quickVote ?? false }));
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
    if (!provider) {
      setError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    try {
      setLoading(true);

      // Use the provider from WalletContext — works with any wallet
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      const tx = await contract.createProposal(
        parseInt(formData.type),
        formData.title,
        formData.description,
        formData.ipfsHash || '',
        formData.quickVote,
      );
      await tx.wait();

      setFormData({ type:'0', title:'', description:'', ipfsHash:'', quickVote:true });
      if (onSuccess) onSuccess();
      alert('✅ Proposal Created!\n\nTransaction confirmed on-chain.');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED')                      setError('Transaction rejected by user');
      else if (err.message.includes('InsufficientReputation')) setError('You need at least 3 reputation');
      else                                                      setError(err.message || 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = PROPOSAL_TYPES.find(t => t.value === formData.type);

  return (
    <div className="cpf-overlay" onClick={onClose}>
      <div className="cpf-modal" onClick={e => e.stopPropagation()}>

        {/* Sticky header */}
        <div className="cpf-header">
          <div>
            <p className="cpf-header-title">Create Proposal</p>
            <p className="cpf-header-sub">Submit for community governance</p>
          </div>
          <button className="cpf-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Form body */}
        <div className="cpf-body">

          {error && (
            <div className="cpf-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {userReputation < 3 && (
            <div className="cpf-rep-warning">
              You need <strong>3 reputation</strong> to create proposals.
              Current: <strong>{userReputation}</strong>
              <div style={{ fontSize:'12px', marginTop:'4px', opacity:0.6 }}>Vote on proposals to earn reputation.</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

            {/* Proposal type */}
            <div>
              <label className="cpf-label">Proposal Type</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {PROPOSAL_TYPES.map(type => (
                  <div key={type.value}
                    className={`cpf-type-option ${formData.type === type.value ? 'selected' : ''}`}
                    onClick={() => !loading && handleTypeChange(type.value)}>
                    <input type="radio" name="proposalType" value={type.value}
                      checked={formData.type === type.value}
                      onChange={() => handleTypeChange(type.value)}
                      style={{ accentColor:'#6366f1' }} disabled={loading} />
                    <div style={{ flex:1 }}>
                      <p className="cpf-type-name">{type.label}</p>
                      <p className="cpf-type-desc">{type.description}</p>
                    </div>
                    {type.quickVote && <span className="cpf-quick-tag">3 days</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="cpf-label">
                Title <span style={{ color:'#f87171', textTransform:'none', fontWeight:400 }}>*</span>
              </label>
              <input type="text" className="cpf-input"
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title:e.target.value }))}
                placeholder="Enter a clear, descriptive title"
                disabled={loading} required />
            </div>

            {/* Description */}
            <div>
              <label className="cpf-label">
                Description <span style={{ color:'#f87171', textTransform:'none', fontWeight:400 }}>*</span>
              </label>
              <textarea className="cpf-input"
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description:e.target.value }))}
                placeholder="Describe your proposal in detail..."
                rows={5} disabled={loading} required
                style={{ resize:'vertical', minHeight:'100px' }} />
            </div>

            {/* IPFS */}
            <div>
              <label className="cpf-label">
                IPFS Hash <span style={{ textTransform:'none', fontWeight:400, opacity:0.5 }}>(optional)</span>
              </label>
              <input type="text" className="cpf-input"
                value={formData.ipfsHash}
                onChange={e => setFormData(p => ({ ...p, ipfsHash:e.target.value }))}
                placeholder="ipfs://Qm..."
                disabled={loading} />
              <p className="cpf-hint">Upload supporting documents to IPFS and paste the hash</p>
            </div>

            {/* Quick vote toggle */}
            <div className="cpf-toggle-row">
              <div>
                <p className="cpf-toggle-label">Quick Vote</p>
                <p className="cpf-toggle-sublabel">3 day period instead of 7 days</p>
              </div>
              <label style={{ position:'relative', display:'inline-flex', alignItems:'center', cursor:'pointer' }}>
                <input type="checkbox" checked={formData.quickVote}
                  onChange={e => setFormData(p => ({ ...p, quickVote:e.target.checked }))}
                  disabled={loading}
                  style={{ position:'absolute', opacity:0, width:0, height:0 }} />
                <div style={{
                  width:'44px', height:'24px', borderRadius:'12px', position:'relative',
                  background: formData.quickVote ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  border: formData.quickVote ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.15)',
                  transition:'all 0.25s ease',
                }}>
                  <div style={{
                    position:'absolute', top:'2px',
                    left: formData.quickVote ? '22px' : '2px',
                    width:'18px', height:'18px', borderRadius:'50%',
                    background:'#ffffff',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.4)',
                    transition:'left 0.25s ease',
                  }} />
                </div>
              </label>
            </div>

            {/* Voting info grid */}
            <div className="cpf-info-grid">
              {[
                ['Voting Period',      selectedType?.quickVote || formData.quickVote ? '3 days' : '7 days'],
                ['Execution Delay',    '2 days after voting'],
                ['Min Votes Required', '5 votes'],
                ['Quorum',             '10% of voters'],
              ].map(([key, val]) => (
                <div key={key}>
                  <p className="cpf-info-key">{key}</p>
                  <p className="cpf-info-val">{val}</p>
                </div>
              ))}
            </div>

            {/* Submit */}
            <button type="submit" className="cpf-submit"
              disabled={loading || userReputation < 3}>
              {loading ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <svg style={{ animation:'spin 1s linear infinite', width:'16px', height:'16px' }}
                    fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
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