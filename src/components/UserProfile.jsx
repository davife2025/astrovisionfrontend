// src/components/UserProfile.jsx
// User profile aligned with AstroDAOSecure.sol delegation system

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import * as  AstroDAO  from '../AstroDAO.json';

const ABI = AstroDAO.abi;
const UserProfile = ({ contractAddress, userAddress }) => {
  const [reputation, setReputation] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [delegate, setDelegate] = useState('');
  const [delegateInput, setDelegateInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userAddress) {
      loadUserData();
    }
  }, [userAddress]);

  const loadUserData = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, AstroDAO, provider);

      const [rep, votes, delegateAddr] = await Promise.all([
        contract.userReputation(userAddress),
        contract.userVoteCount(userAddress),
        contract.delegates(userAddress)
      ]);

      setReputation(Number(rep));
      setVoteCount(Number(votes));
      setDelegate(delegateAddr === ethers.ZeroAddress ? '' : delegateAddr);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleDelegate = async () => {
    if (!delegateInput.trim()) {
      alert('Please enter a delegate address');
      return;
    }

    if (!ethers.isAddress(delegateInput)) {
      alert('Invalid Ethereum address');
      return;
    }

    try {
      setLoading(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      const tx = await contract.delegate(delegateInput);
      console.log('Delegation transaction:', tx.hash);
      
      await tx.wait();
      console.log('Delegation confirmed!');

      setDelegate(delegateInput);
      setDelegateInput('');
      alert('Voting power delegated successfully!');
    } catch (error) {
      console.error('Error delegating:', error);
      
      if (error.code === 'ACTION_REJECTED') {
        alert('Transaction rejected');
      } else if (error.message.includes('Cannot delegate to self')) {
        alert('You cannot delegate to yourself');
      } else {
        alert('Failed to delegate: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUndelegate = async () => {
    try {
      setLoading(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, ABI, signer);

      const tx = await contract.undelegate();
      console.log('Undelegation transaction:', tx.hash);
      
      await tx.wait();
      console.log('Undelegation confirmed!');

      setDelegate('');
      alert('Delegation removed successfully!');
    } catch (error) {
      console.error('Error undelegating:', error);
      
      if (error.code === 'ACTION_REJECTED') {
        alert('Transaction rejected');
      } else if (error.message.includes('Not delegating')) {
        alert('You are not currently delegating');
      } else {
        alert('Failed to undelegate: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const reputationPercent = ((reputation / 10000) * 100).toFixed(1);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Your Profile</h2>

      {/* Reputation Display */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Reputation</span>
          <span className="text-sm text-gray-600">{reputation} / 10,000</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${reputationPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{reputationPercent}% of maximum</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm text-indigo-600 font-medium">Votes Cast</p>
          <p className="text-2xl font-bold text-indigo-700">{voteCount}</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium">Reputation</p>
          <p className="text-2xl font-bold text-purple-700">{reputation}</p>
        </div>
      </div>

      {/* Delegation Section */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Voting Delegation</h3>
        
        {delegate ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 mb-2">
              ⚠️ Your voting power is delegated to:
            </p>
            <p className="font-mono text-sm text-gray-800 mb-3 break-all">{delegate}</p>
            <p className="text-xs text-yellow-700 mb-3">
              You cannot vote while delegating. Undelegate to vote yourself.
            </p>
            <button
              onClick={handleUndelegate}
              disabled={loading}
              className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : 'Remove Delegation'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              Delegate your voting power to another address. They will be able to vote on your behalf.
            </p>
            
            <input
              type="text"
              value={delegateInput}
              onChange={(e) => setDelegateInput(e.target.value)}
              placeholder="0x... delegate address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            
            <button
              onClick={handleDelegate}
              disabled={loading || !delegateInput}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : 'Delegate Voting Power'}
            </button>
          </div>
        )}
      </div>

      {/* Earning Reputation Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">How to Earn Reputation</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Vote on proposals: +1 reputation</li>
          <li>• Create proposals: Earn when executed</li>
          <li>• Execute proposals: +5 reputation</li>
          <li>• Active participation: Awarded by admin</li>
          <li>• Maximum: 10,000 reputation</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfile;
