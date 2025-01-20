import React, { useState } from 'react';
import { TextField, Button, Container, Box, Typography } from '@mui/material';
import BubbleMap from './components/BubbleMap';
import './App.css';

interface TokenHolder {
  address: string;
  quantity: number;
}

declare global {
  interface Window {
    _env_: {
      BLOCKFROST_API_KEY: string;
    }
  }
}

function App() {
  const [policyId, setPolicyId] = useState('');
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTokenHolders = async () => {
    setLoading(true);
    setError('');
    try {
      // Get all assets under this policy
      const assetsResponse = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/policy/${policyId}`,
        {
          headers: {
            'project_id': window._env_?.BLOCKFROST_API_KEY || '',
          },
        }
      );

      if (!assetsResponse.ok) {
        if (assetsResponse.status === 404) {
          throw new Error('No assets found for this policy ID. Please check if the policy ID is correct.');
        }
        if (assetsResponse.status === 403) {
          throw new Error('API key error. Please check your Blockfrost API key.');
        }
        throw new Error(`API error: ${assetsResponse.status}`);
      }

      const assets = await assetsResponse.json();
      
      if (!Array.isArray(assets) || assets.length === 0) {
        throw new Error('No assets found for this policy ID');
      }

      // Get holders for the first asset in the policy
      const assetId = assets[0].asset;
      console.log('Fetching holders for asset:', assetId);
      
      const holdersResponse = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/${assetId}/addresses`,
        {
          headers: {
            'project_id': window._env_?.BLOCKFROST_API_KEY || '',
          },
        }
      );

      if (!holdersResponse.ok) {
        if (holdersResponse.status === 404) {
          throw new Error('No holder information found for this asset.');
        }
        if (holdersResponse.status === 403) {
          throw new Error('API key error. Please check your Blockfrost API key.');
        }
        throw new Error(`API error: ${holdersResponse.status}`);
      }

      const holders = await holdersResponse.json();
      
      if (!Array.isArray(holders) || holders.length === 0) {
        throw new Error('No holders found for this asset');
      }

      console.log('Found holders:', holders.length);
      
      const formattedHolders = holders.map((holder: any) => ({
        address: holder.address,
        quantity: parseInt(holder.quantity, 10)
      }));

      setHolders(formattedHolders);
    } catch (err) {
      console.error('Error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error fetching token holders. Please check the policy ID and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Cardano Token Bubble Map
        </Typography>
        
        <Box sx={{ my: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <TextField
            label="Token Policy ID"
            variant="outlined"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            sx={{ width: '400px' }}
            placeholder="e.g., d5e6bf0500378d4f0da4e8dde6becec7621cd8cbf5cbb9b87013d4cc"
            helperText="Enter a Cardano token policy ID to visualize holder distribution"
          />
          <Button
            variant="contained"
            onClick={fetchTokenHolders}
            disabled={loading || !policyId}
          >
            {loading ? 'Loading...' : 'Visualize'}
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        {holders.length > 0 && (
          <Box sx={{ mt: 4, height: '600px' }}>
            <BubbleMap holders={holders} />
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
