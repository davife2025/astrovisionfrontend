// src/components/CreateProposalForm.jsx
// Aligned with AstroDAOSecure.sol

import React, { useState } from 'react';
import { ethers } from 'ethers';
import  AstroDAO  from '../AstroDAO.json';
const ABI = AstroDAO.abi;

const CreateProposalForm = ({ contractAddress, userReputation, onSuccess }) => {
  const [formData, setFormData] = useState({
    type: '0', // WEEKLY_THEME
    title: '',
    description: '',
    ipfsHash: '',
    quickVote: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Proposal types matching contract enum
  const PROPOSAL_TYPES = [
    { value: '0', label: 'Weekly Theme', quickVote: true },
    { value: '1', label: 'Research Discovery', quickVote: false },
    { value: '2', label: 'Community Proposal', quickVote: false },
    { value: '3', label: 'Knowledge Sharing', quickVote: false },
    { value: '4', label: 'Collaboration', quickVote: false }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    
    if (userReputation < 3) {
      setError('You need at least 3 reputation to create a proposal');
      return;
    }

    try {
      setLoading(true);

      // Connect to contract
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      // Call createProposal
      const tx = await contract.createProposal(
        parseInt(formData.type),      // ProposalType
        formData.title,                // title
        formData.description,          // description
        formData.ipfsHash || '',       // ipfsHash (empty if none)
        formData.quickVote             // quickVote boolean
      );

      console.log('Transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Proposal created!', receipt);

      // Reset form
      setFormData({
        type: '0',
        title: '',
        description: '',
        ipfsHash: '',
        quickVote: false
      });

      if (onSuccess) onSuccess();
      
      alert('Proposal created successfully!');
    } catch (err) {
      console.error('Error creating proposal:', err);
      
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user');
      } else if (err.message.includes('InsufficientReputation')) {
        setError('You need at least 3 reputation to create proposals');
      } else {
        setError(err.message || 'Failed to create proposal');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (e) => {
    const typeValue = e.target.value;
    const selectedType = PROPOSAL_TYPES.find(t => t.value === typeValue);
    
    setFormData({
      ...formData,
      type: typeValue,
      quickVote: selectedType?.quickVote || false
    });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Create Proposal</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {userReputation < 3 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⚠️ You need 3 reputation to create proposals. Current: {userReputation}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Proposal Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proposal Type
          </label>
          <select
            value={formData.type}
            onChange={handleTypeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {PROPOSAL_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter proposal title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your proposal in detail"
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            required
          />
        </div>

        {/* IPFS Hash (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            IPFS Hash (Optional)
          </label>
          <input
            type="text"
            value={formData.ipfsHash}
            onChange={(e) => setFormData({ ...formData, ipfsHash: e.target.value })}
            placeholder="ipfs://... (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Upload supporting documents to IPFS and paste the hash here
          </p>
        </div>

        {/* Quick Vote Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="quickVote"
            checked={formData.quickVote}
            onChange={(e) => setFormData({ ...formData, quickVote: e.target.checked })}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            disabled={loading}
          />
          <label htmlFor="quickVote" className="ml-2 text-sm text-gray-700">
            Quick Vote (3 days instead of 7 days)
          </label>
        </div>

        {/* Voting Period Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Voting Period:</strong> {formData.quickVote ? '3 days' : '7 days'}
            <br />
            <strong>Execution Delay:</strong> 2 days after voting ends
            <br />
            <strong>Min Votes Required:</strong> 5 votes
            <br />
            <strong>Quorum:</strong> 10% of total voters
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || userReputation < 3}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Proposal...
            </span>
          ) : (
            'Create Proposal'
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateProposalForm;
