import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Container, 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  SelectChangeEvent,
  CircularProgress,
  Alert,
  ThemeProvider,
  createTheme,
  CssBaseline,
  styled
} from '@mui/material';
import BubbleMap from './components/BubbleMap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0A0B0D',
      paper: '#1A1B1E',
    },
    primary: {
      main: '#3B82F6',
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#1A1B1E',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1B1E',
        },
      },
    },
  },
});

const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  background: '#0A0B0D',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const HeaderBox = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(6),
  '& h1': {
    fontSize: '2.5rem',
    fontWeight: 700,
    background: 'linear-gradient(45deg, #3B82F6 30%, #60A5FA 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
}));

const SearchBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: theme.spacing(4),
  '& .MuiTextField-root': {
    width: '400px',
  },
  '& .MuiButton-root': {
    height: '56px',
    minWidth: '120px',
    background: 'linear-gradient(45deg, #3B82F6 30%, #60A5FA 90%)',
    boxShadow: '0 3px 5px 2px rgba(59, 130, 246, .3)',
    '&:hover': {
      background: 'linear-gradient(45deg, #2563EB 30%, #3B82F6 90%)',
    },
  },
}));

interface TokenHolder {
  address: string;
  quantity: string;
  relatedAddresses?: string[];
}

interface Asset {
  asset: string;
  quantity: string;
  metadata?: {
    name?: string;
    ticker?: string;
    decimals?: number;
  };
  fingerprint?: string;
  policy_id?: string;
}

interface TokenMetadata {
  decimals: number;
  symbol: string;
}

interface HolderData {
  [address: string]: number;
}

interface AddressInfo {
  stake_address: string;
  address: string;
}

interface StakeAddressCache {
  stakeAddress: string;
  addresses: Set<string>;
}

declare global {
  interface Window {
    _env_: {
      REACT_APP_BLOCKFROST_API_KEY: string;
    }
  }
}

// Cache duration in milliseconds
const CACHE_TIME = 1000 * 60 * 5; // 5 minutes

// Rate limiting constants based on Blockfrost docs
const REQUESTS_PER_SECOND = 10;
const BURST_LIMIT = 500;
const REQUEST_INTERVAL = 1000 / REQUESTS_PER_SECOND; // 100ms between requests
const BATCH_SIZE = 8; // Reduced from 20 to stay well within rate limits

// Improved rate limiter with token bucket algorithm
class RateLimiter {
  private tokens: number = BURST_LIMIT;
  private lastRefill: number = Date.now();
  private queue: Array<() => Promise<any>> = [];
  private processing: boolean = false;

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        setTimeout(() => this.processQueue(), REQUEST_INTERVAL);
      }
    } else {
      // Wait for token refill
      setTimeout(() => this.processQueue(), REQUEST_INTERVAL);
    }
  }

  private refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = Math.floor(timePassed / REQUEST_INTERVAL);
    
    if (newTokens > 0) {
      this.tokens = Math.min(BURST_LIMIT, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}

const rateLimiter = new RateLimiter();

function App() {
  const [policyId, setPolicyId] = useState('');
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const queryClient = useQueryClient();

  // Cached asset query
  const { data: assetData, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', policyId],
    queryFn: () => fetchAssetsForPolicy(policyId, window._env_.REACT_APP_BLOCKFROST_API_KEY),
    enabled: !!policyId,
    staleTime: CACHE_TIME,
    cacheTime: CACHE_TIME,
  });

  // Cached holders query
  const { data: holdersData, isLoading: holdersLoading } = useQuery({
    queryKey: ['holders', selectedAsset],
    queryFn: () => selectedAsset ? fetchHoldersForAsset(selectedAsset, window._env_.REACT_APP_BLOCKFROST_API_KEY) : Promise.resolve([]),
    enabled: !!selectedAsset,
    staleTime: CACHE_TIME,
    cacheTime: CACHE_TIME,
  });

  const formatTokenAmount = (amount: string, decimals: number = 0): string => {
    const rawAmount = BigInt(amount);
    if (decimals === 0) return rawAmount.toString();
    
    const divisor = BigInt(10 ** decimals);
    const integerPart = rawAmount / divisor;
    const fractionalPart = rawAmount % divisor;
    
    let formattedFraction = fractionalPart.toString().padStart(decimals, '0');
    // Remove trailing zeros
    while (formattedFraction.endsWith('0') && formattedFraction.length > 1) {
      formattedFraction = formattedFraction.slice(0, -1);
    }
    
    return formattedFraction === '0' 
      ? integerPart.toString()
      : `${integerPart}.${formattedFraction}`;
  };

  const fetchAssetDetails = async (assetId: string, apiKey: string): Promise<TokenMetadata> => {
    try {
      const response = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/${assetId}`,
        {
          headers: {
            'project_id': apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch asset details: ${response.status}`);
      }

      const data = await response.json();
      return {
        decimals: data.metadata?.decimals || 0,
        symbol: data.metadata?.ticker || data.metadata?.name || 'Unknown'
      };
    } catch (error) {
      console.error('Error fetching asset details:', error);
      return { decimals: 0, symbol: 'Unknown' };
    }
  };

  const fetchAssetsForPolicy = async (policyId: string, apiKey: string): Promise<Asset[]> => {
    let allAssets: Asset[] = [];
    let page = 1;
    const count = 100; // Blockfrost default page size

    while (true) {
      const response = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/policy/${policyId}?page=${page}&count=${count}&order=asc`,
        {
          headers: {
            'project_id': apiKey,
          },
        }
      );

      if (!response.ok) {
        handleApiError(response.status, await response.text());
        break;
      }

      const assets = await response.json();
      if (!Array.isArray(assets) || assets.length === 0) {
        break;
      }

      allAssets = [...allAssets, ...assets];
      if (assets.length < count) {
        break;
      }
      page++;
    }

    return allAssets;
  };

  const fetchHoldersForAsset = async (assetId: string, apiKey: string): Promise<any[]> => {
    let allHolders: any[] = [];
    let page = 1;
    const count = 100;
    const maxHolders = 150; // Limit to top 150 holders

    while (allHolders.length < maxHolders) {
      const response = await fetch(
        `https://cardano-mainnet.blockfrost.io/api/v0/assets/${assetId}/addresses?page=${page}&count=${count}&order=desc`,
        {
          headers: {
            'project_id': apiKey,
          },
        }
      );

      if (!response.ok) {
        handleApiError(response.status, await response.text());
        break;
      }

      const holders = await response.json();
      if (!Array.isArray(holders) || holders.length === 0) {
        break;
      }

      allHolders = [...allHolders, ...holders];
      if (holders.length < count || allHolders.length >= maxHolders) {
        break;
      }
      page++;
    }

    // Only return top 150 holders
    return allHolders.slice(0, maxHolders);
  };

  const findRelatedWallets = async (holders: TokenHolder[], apiKey: string): Promise<TokenHolder[]> => {
    const relatedWallets = new Map<string, Set<string>>();
    const stakeAddressMap = new Map<string, Set<string>>();
    const batchSize = BATCH_SIZE;

    // First, get stake addresses for all holders
    for (let i = 0; i < holders.length; i += batchSize) {
      const batch = holders.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (holder) => {
          try {
            const cacheKey = `stake-${holder.address}`;
            const cached = queryClient.getQueryData([cacheKey]);
            
            if (cached) {
              const { stakeAddress, addresses } = cached as StakeAddressCache;
              stakeAddressMap.set(stakeAddress, addresses);
              return;
            }

            const response = await rateLimiter.schedule(() =>
              fetch(
                `https://cardano-mainnet.blockfrost.io/api/v0/addresses/${holder.address}`,
                {
                  headers: {
                    'project_id': apiKey,
                  },
                }
              )
            );

            if (!response.ok) return;

            const addressInfo: AddressInfo = await response.json();
            const stakeAddress = addressInfo.stake_address;
            
            if (stakeAddress) {
              // Get all addresses under this stake address
              const stakeResponse = await rateLimiter.schedule(() =>
                fetch(
                  `https://cardano-mainnet.blockfrost.io/api/v0/accounts/${stakeAddress}/addresses`,
                  {
                    headers: {
                      'project_id': apiKey,
                    },
                  }
                )
              );

              if (stakeResponse.ok) {
                const addressList: { address: string }[] = await stakeResponse.json();
                const addresses: Set<string> = new Set(addressList.map((a) => a.address));
                
                // Only include addresses that are in our holders list
                const relevantAddresses: Set<string> = new Set(
                  [...addresses].filter(addr => holders.some(h => h.address === addr))
                );

                if (relevantAddresses.size > 1) {
                  stakeAddressMap.set(stakeAddress, relevantAddresses);
                  
                  // Cache the results
                  queryClient.setQueryData([cacheKey], {
                    stakeAddress,
                    addresses: relevantAddresses
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error finding related wallets:', error);
          }
        })
      );
      
      // Add a small delay between batches
      if (i + batchSize < holders.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL * batchSize));
      }
    }

    // Convert stake address groups to related wallets
    stakeAddressMap.forEach((addresses) => {
      addresses.forEach(address => {
        const related = new Set(Array.from(addresses));
        related.delete(address); // Remove self from related set
        if (related.size > 0) {
          relatedWallets.set(address, related);
        }
      });
    });

    return holders.map(holder => ({
      ...holder,
      relatedAddresses: Array.from(relatedWallets.get(holder.address) || [])
    }));
  };

  const fetchHolders = async (assetId: string) => {
    try {
      const apiKey = window._env_?.REACT_APP_BLOCKFROST_API_KEY || '';
      
      // Get asset details first
      const assetDetails = await fetchAssetDetails(assetId, apiKey);
      const holders = await fetchHoldersForAsset(assetId, apiKey);
      
      if (!Array.isArray(holders) || holders.length === 0) {
        throw new Error('No holders found for this asset');
      }

      let totalSupply = 0;
      const formattedHolders = holders.map(holder => {
        const quantity = parseInt(holder.quantity, 10);
        totalSupply += quantity;
        return {
          address: holder.address,
          quantity: formatTokenAmount(holder.quantity, assetDetails.decimals)
        };
      });

      // Find related wallets
      const holdersWithRelations = await findRelatedWallets(formattedHolders, apiKey);

      setTotalSupply(parseFloat(formatTokenAmount(totalSupply.toString(), assetDetails.decimals)));
      setHolders(holdersWithRelations);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error fetching holders');
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    setError('');
    setAssets([]);
    setSelectedAsset('');
    setHolders([]);
    setTotalSupply(0);

    try {
      const apiKey = window._env_?.REACT_APP_BLOCKFROST_API_KEY || '';
      if (!apiKey) {
        throw new Error('Blockfrost API key is not configured');
      }

      // Get all assets under this policy
      const assetsData = await fetchAssetsForPolicy(policyId, apiKey);
      
      if (assetsData.length === 0) {
        throw new Error('No assets found for this policy ID');
      }

      setAssets(assetsData);
      
      // If there's only one asset, fetch its holders immediately
      if (assetsData.length === 1) {
        setSelectedAsset(assetsData[0].asset);
        await fetchHolders(assetsData[0].asset);
      } else {
        // For fungible tokens, aggregate all assets
        const isFungibleToken = assetsData.every(asset => 
          !asset.metadata?.name || asset.metadata.name === assetsData[0].metadata?.name
        );

        if (isFungibleToken) {
          await aggregateHoldersForAllAssets(assetsData, apiKey);
        } else {
          setSelectedAsset(assetsData[0].asset);
          await fetchHolders(assetsData[0].asset);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error fetching assets');
    } finally {
      setLoading(false);
    }
  };

  const aggregateHoldersForAllAssets = async (assets: Asset[], apiKey: string) => {
    try {
      const holdersMap: HolderData = {};
      let supply = 0;
      
      // Get the first asset's details to determine decimals
      const assetDetails = await fetchAssetDetails(assets[0].asset, apiKey);
      const decimals = assetDetails.decimals;

      // Fetch holders for each asset
      for (const asset of assets) {
        const holders = await fetchHoldersForAsset(asset.asset, apiKey);
        
        // Add quantities to the map
        for (const holder of holders) {
          const quantity = parseInt(holder.quantity, 10);
          holdersMap[holder.address] = (holdersMap[holder.address] || 0) + quantity;
          supply += quantity;
        }
      }

      // Convert map to array and sort by quantity
      const combinedHolders = Object.entries(holdersMap)
        .map(([address, quantity]) => ({
          address,
          quantity: formatTokenAmount(quantity.toString(), decimals)
        }))
        .sort((a, b) => parseFloat(b.quantity) - parseFloat(a.quantity));

      setTotalSupply(parseFloat(formatTokenAmount(supply.toString(), decimals)));
      setHolders(combinedHolders);
    } catch (err) {
      console.error('Error aggregating holders:', err);
      throw err;
    }
  };

  const handleAssetChange = async (event: SelectChangeEvent) => {
    const newAssetId = event.target.value;
    setSelectedAsset(newAssetId);
    setLoading(true);
    setError('');
    await fetchHolders(newAssetId);
  };

  const handleApiError = (status: number, errorText: string) => {
    console.log('Response status:', status);
    if (status === 404) {
      throw new Error('No assets found for this policy ID. Please check if the policy ID is correct.');
    }
    if (status === 403) {
      console.log('Error response:', errorText);
      throw new Error(`API key error (403 Forbidden). Please check your Blockfrost API key. Details: ${errorText}`);
    }
    throw new Error(`API error: ${status}`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <StyledContainer maxWidth={false}>
        <HeaderBox>
          <Typography variant="h1" component="h1" align="center">
            Cardano Token Distribution
          </Typography>
          <Typography variant="subtitle1" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
            Visualize token holder distribution for any Cardano token
          </Typography>
        </HeaderBox>

        <SearchBox>
          <TextField
            label="Token Policy ID"
            variant="outlined"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            placeholder="e.g., d5e6bf0500378d4f0da4e8dde6becec7621cd8cbf5cbb9b87013d4cc"
            helperText="Enter a Cardano token policy ID to visualize holder distribution"
          />
          <Button
            variant="contained"
            onClick={fetchAssets}
            disabled={loading || !policyId}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Analyze'}
          </Button>
        </SearchBox>

        {assets.length > 0 && (
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
            <FormControl sx={{ minWidth: 300 }}>
              <InputLabel>Select Asset</InputLabel>
              <Select
                value={selectedAsset}
                onChange={handleAssetChange}
                label="Select Asset"
              >
                {assets.map((asset) => (
                  <MenuItem key={asset.asset} value={asset.asset}>
                    {asset.metadata?.name || asset.asset}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2, 
              mx: 'auto', 
              maxWidth: 600,
              backgroundColor: '#2D1618',
              color: '#FCA5A5',
              '& .MuiAlert-icon': {
                color: '#FCA5A5'
              }
            }}
          >
            {error}
          </Alert>
        )}

        {holders.length > 0 && (
          <Box sx={{ 
            mt: 4, 
            height: 'calc(100vh - 300px)',
            minHeight: '600px',
            backgroundColor: '#1A1B1E',
            borderRadius: '12px',
            padding: 2,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
          }}>
            <BubbleMap 
              holders={holders} 
              totalSupply={holders.reduce((sum, holder) => sum + parseFloat(holder.quantity), 0)}
            />
          </Box>
        )}
      </StyledContainer>
    </ThemeProvider>
  );
}

export default App;
