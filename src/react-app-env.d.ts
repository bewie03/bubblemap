/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_BLOCKFROST_API_KEY: string;
    // Add other environment variables here if needed
  }
}
