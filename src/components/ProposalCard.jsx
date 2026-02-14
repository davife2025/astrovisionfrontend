// src/components/ProposalCard.jsx
// Aligned with AstroDAOSecure.sol VoteChoice enum

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { AstroDAO } from '../AstroDAO.json';

const ABI = AstroDAO.abi;
const ProposalCard = ({ proposal, contractAddress, userAddress, onVoteSuccess }) => {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');

  // Proposal Types (matching contract enum)
  const PROPOSAL_TYPES = {
    0: 'Weekly Theme',
    1: 'Research Discovery',
    2: 'Community Proposal',
    3: 'Knowledge Sharing',
    4: 'Collaboration'
  };

  // Proposal Status (matching contract enum)
  const PROPOSAL_STATUS = {
    0: { label: 'Pending', color: 'gray' },
    1: { label: 'Active', color: 'blue' },
    2: { label: 'Passed', color: 'green' },
    3: { label: 'Rejected', color: 'red' },
    4: { label: 'Queued', color: 'yellow' },
    5: { label: 'Executed', color: 'purple' },
    6: { label: 'Cancelled', color: 'gray' }
  };

  // Vote Choices (matching contract enum)
  const VOTE_CHOICES = {
    AGAINST: 0,
    FOR: 1,
    ABSTAIN: 2
  };

  const handleVote = async (choice) => {
    setError('');
    setVoting(true);

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      // Call vote function with proposalId and choice (0=AGAINST, 1=FOR, 2=ABSTAIN)
      const tx = await contract.vote(
        proposal.id,
        choice
      );

      console.log('Vote transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Vote confirmed!', receipt);

      if (onVoteSuccess) onVoteSuccess();
      
      alert('Vote cast successfully! +1 Reputation earned');
    } catch (err) {
      console.error('Error voting:', err);
      
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected');
      } else if (err.message.includes('AlreadyVoted')) {
        setError('You have already voted on this proposal');
      } else if (err.message.includes('AlreadyDelegated')) {
        setError('Cannot vote - you have delegated your voting power');
      } else if (err.message.includes('Voting period ended')) {
        setError('Voting period has ended');
      } else {
        setError(err.message || 'Failed to cast vote');
      }
    } finally {
      setVoting(false);
    }
  };

  const handleFinalize = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      const tx = await contract.finalizeProposal(proposal.id);
      await tx.wait();
      
      if (onVoteSuccess) onVoteSuccess();
      alert('Proposal finalized!');
    } catch (err) {
      console.error('Error finalizing:', err);
      alert('Failed to finalize: ' + err.message);
    }
  };

  const handleExecute = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      const tx = await contract.executeProposal(proposal.id);
      await tx.wait();
      
      if (onVoteSuccess) onVoteSuccess();
      alert('Proposal executed! +5 Reputation earned');
    } catch (err) {
      console.error('Error executing:', err);
      alert('Failed to execute: ' + err.message);
    }
  };

  // Calculate total votes
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  
  // Calculate percentages
  const forPercent = totalVotes > 0 ? (proposal.votesFor / totalVotes * 100).toFixed(1) : 0;
  const againstPercent = totalVotes > 0 ? (proposal.votesAgainst / totalVotes * 100).toFixed(1) : 0;
  const abstainPercent = totalVotes > 0 ? (proposal.votesAbstain / totalVotes * 100).toFixed(1) : 0;

  // Check if voting is active
  const now = Math.floor(Date.now() / 1000);
  const isActive = proposal.status === 1 && now <= proposal.endTime;
  const canFinalize = proposal.status === 1 && now > proposal.endTime;
  const canExecute = proposal.status === 4 && now >= proposal.executionTime;

  // Get status info
  const statusInfo = PROPOSAL_STATUS[proposal.status] || { label: 'Unknown', color: 'gray' };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-4 border-l-4 border-indigo-500">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{proposal.title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Proposal #{proposal.id} • {PROPOSAL_TYPES[proposal.proposalType]}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-gray-700 mb-4">{proposal.description}</p>

      {/* IPFS Link */}
      {proposal.ipfsHash && (
        <a
          href={proposal.ipfsHash}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
        >
          📄 View supporting documents →
        </a>
      )}

      {/* Voting Stats */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Total Votes: {totalVotes}</span>
          <span>
            {isActive ? (
              <>Ends: {new Date(proposal.endTime * 1000).toLocaleString()}</>
            ) : (
              <>Ended: {new Date(proposal.endTime * 1000).toLocaleString()}</>
            )}
          </span>
        </div>

        {/* Vote Bars */}
        <div className="space-y-2">
          {/* For */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-600 font-medium">For: {proposal.votesFor}</span>
              <span className="text-green-600">{forPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${forPercent}%` }}
              />
            </div>
          </div>

          {/* Against */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-600 font-medium">Against: {proposal.votesAgainst}</span>
              <span className="text-red-600">{againstPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${againstPercent}%` }}
              />
            </div>
          </div>

          {/* Abstain */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">Abstain: {proposal.votesAbstain}</span>
              <span className="text-gray-600">{abstainPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-400 h-2 rounded-full"
                style={{ width: `${abstainPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Vote Buttons (only if active) */}
        {isActive && (
          <>
            <button
              onClick={() => handleVote(VOTE_CHOICES.FOR)}
              disabled={voting}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {voting ? '...' : '✓ Vote For'}
            </button>
            
            <button
              onClick={() => handleVote(VOTE_CHOICES.AGAINST)}
              disabled={voting}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {voting ? '...' : '✗ Vote Against'}
            </button>
            
            <button
              onClick={() => handleVote(VOTE_CHOICES.ABSTAIN)}
              disabled={voting}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {voting ? '...' : '○ Abstain'}
            </button>
          </>
        )}

        {/* Finalize Button */}
        {canFinalize && (
          <button
            onClick={handleFinalize}
            className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
          >
            Finalize Proposal
          </button>
        )}

        {/* Execute Button */}
        {canExecute && (
          <button
            onClick={handleExecute}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Execute Proposal
          </button>
        )}

        {/* Execution Info */}
        {proposal.status === 4 && now < proposal.executionTime && (
          <div className="flex-1 text-center p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              Can execute after:<br />
              {new Date(proposal.executionTime * 1000).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Proposer Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Proposed by: {proposal.proposer === userAddress ? 'You' : `${proposal.proposer.slice(0, 6)}...${proposal.proposer.slice(-4)}`}
        </p>
      </div>
    </div>
  );
};

export default ProposalCard;
