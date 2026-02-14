// src/components/DAODashboard.jsx
// Main dashboard aligned with AstroDAOSecure.sol

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import * as AstroDAO  from '../AstroDAO.json';
import CreateProposalForm from './CreateProposalForm';
import ProposalCard from './ProposalCard';

const ABI = AstroDAO.abi;
const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS || '0x...';
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID) || 56;

const DAODashboard = () => {
  const [account, setAccount] = useState('');
  const [userReputation, setUserReputation] = useState(0);
  const [userVoteCount, setUserVoteCount] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [activeWeeklyTheme, setActiveWeeklyTheme] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    connectWallet();
  }, []);

  useEffect(() => {
    if (account) {
      loadDashboardData();
    }
  }, [account]);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Check network
      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });
      
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          // Network not added
          if (switchError.code === 4902) {
            alert('Please add BNB Chain to MetaMask');
          }
        }
      }

      setAccount(accounts[0]);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0] || '');
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      // Load user stats
      const [reputation, voteCount, totalCount, propCount, week, activeTheme] = await Promise.all([
        contract.userReputation(account),
        contract.userVoteCount(account),
        contract.totalVoterCount(),
        contract.proposalCount(),
        contract.currentWeek(),
        contract.activeWeeklyTheme()
      ]);

      setUserReputation(Number(reputation));
      setUserVoteCount(Number(voteCount));
      setTotalVoters(Number(totalCount));
      setProposalCount(Number(propCount));
      setCurrentWeek(Number(week));
      setActiveWeeklyTheme(Number(activeTheme));

      // Load all proposals
      const proposalsList = [];
      for (let i = 1; i <= Number(propCount); i++) {
        try {
          const proposal = await contract.getProposal(i);
          proposalsList.push({
            id: Number(proposal.id),
            proposer: proposal.proposer,
            proposalType: Number(proposal.proposalType),
            title: proposal.title,
            description: proposal.description,
            ipfsHash: proposal.ipfsHash,
            votesFor: Number(proposal.votesFor),
            votesAgainst: Number(proposal.votesAgainst),
            votesAbstain: Number(proposal.votesAbstain),
            endTime: Number(proposal.endTime),
            executionTime: Number(proposal.executionTime),
            status: Number(proposal.status)
          });
        } catch (err) {
          console.error(`Error loading proposal ${i}:`, err);
        }
      }

      setProposals(proposalsList.reverse()); // Show newest first
    } catch (error) {
      console.error('Error loading dashboard:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Filter proposals
  const filteredProposals = filterType === 'all' 
    ? proposals 
    : proposals.filter(p => p.proposalType === parseInt(filterType));

  const PROPOSAL_TYPES = [
    { value: 'all', label: 'All Proposals' },
    { value: '0', label: 'Weekly Themes' },
    { value: '1', label: 'Research Discoveries' },
    { value: '2', label: 'Community Proposals' },
    { value: '3', label: 'Knowledge Sharing' },
    { value: '4', label: 'Collaborations' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">AstroDAO Governance</h1>
          <p className="text-indigo-100">Community-driven scientific research voting</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Wallet Connection */}
        {!account ? (
          <div className="text-center py-12">
            <button
              onClick={connectWallet}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* User Reputation */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-sm mb-1">Your Reputation</p>
                <p className="text-3xl font-bold text-indigo-600">{userReputation}</p>
                <p className="text-xs text-gray-500 mt-1">/ 10,000 max</p>
              </div>

              {/* Votes Cast */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-sm mb-1">Votes Cast</p>
                <p className="text-3xl font-bold text-green-600">{userVoteCount}</p>
                <p className="text-xs text-gray-500 mt-1">+1 rep per vote</p>
              </div>

              {/* Total Proposals */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-sm mb-1">Total Proposals</p>
                <p className="text-3xl font-bold text-purple-600">{proposalCount}</p>
                <p className="text-xs text-gray-500 mt-1">Week #{currentWeek}</p>
              </div>

              {/* Total Voters */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-sm mb-1">Total Voters</p>
                <p className="text-3xl font-bold text-blue-600">{totalVoters}</p>
                <p className="text-xs text-gray-500 mt-1">Unique participants</p>
              </div>
            </div>

            {/* Active Weekly Theme */}
            {activeWeeklyTheme > 0 && (
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-2">🌟 Active Weekly Theme</h3>
                <p className="text-lg">Proposal #{activeWeeklyTheme} is currently active</p>
              </div>
            )}

            {/* Account Info */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Connected Wallet</p>
                  <p className="font-mono text-sm">{account}</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  disabled={userReputation < 3}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {showCreateForm ? 'View Proposals' : 'Create Proposal'}
                </button>
              </div>
            </div>

            {/* Create Proposal Form */}
            {showCreateForm && (
              <div className="mb-8">
                <CreateProposalForm
                  contractAddress={CONTRACT_ADDRESS}
                  userReputation={userReputation}
                  onSuccess={() => {
                    setShowCreateForm(false);
                    loadDashboardData();
                  }}
                />
              </div>
            )}

            {/* Proposals Section */}
            {!showCreateForm && (
              <>
                {/* Filter Tabs */}
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto">
                      {PROPOSAL_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => setFilterType(type.value)}
                          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            filterType === type.value
                              ? 'border-indigo-500 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* Proposals List */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Loading proposals...</p>
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No proposals found</p>
                    {userReputation >= 3 && (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Create the first one →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredProposals.map(proposal => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        contractAddress={CONTRACT_ADDRESS}
                        userAddress={account}
                        onVoteSuccess={loadDashboardData}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DAODashboard;
