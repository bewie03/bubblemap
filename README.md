# Cardano Crypto Bubble Map

An interactive visualization tool for Cardano token distributions across wallets. This application allows users to enter a token policy ID and view the distribution of token holdings as an interactive bubble map.

## Features

- Search by token policy ID
- Interactive bubble visualization of token holders
- Hover tooltips showing wallet details
- Responsive design
- Real-time Cardano blockchain data via Blockfrost API

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Blockfrost API key (sign up at https://blockfrost.io)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd cardano-bubble-map
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Blockfrost API key:
```
REACT_APP_BLOCKFROST_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm start
```

The application will be available at http://localhost:3000

## Usage

1. Enter a valid Cardano token policy ID in the search field
2. Click "Visualize" to generate the bubble map
3. Hover over bubbles to see detailed information about each wallet
4. The size of each bubble represents the relative token holdings

## Tech Stack

- React
- TypeScript
- D3.js (for visualization)
- Material-UI (for UI components)
- Blockfrost API (for Cardano blockchain data)

## License

MIT
