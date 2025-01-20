import React, { useState } from 'react';
import { TextField, Button, Container, Box, Typography } from '@mui/material';
import BubbleMap from './components/BubbleMap';
import './App.css';

interface TokenHolder {
  address: string;
  quantity: number;
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
      const response = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/policy/${policyId}/addresses`,
        {
          headers: {
            'project_id': process.env.REACT_APP_BLOCKFROST_API_KEY || '',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const formattedHolders = data.map((holder: any) => ({
        address: holder.address,
        quantity: parseInt(holder.quantity, 10)
      }));

      setHolders(formattedHolders);
    } catch (err) {
      setError('Error fetching token holders. Please check the policy ID and try again.');
      console.error(err);
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
