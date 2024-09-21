import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dash';
import History from './pages/History';
import './App.css';

const App: React.FC = () => {
  const isWalletConnected = !!localStorage.getItem('walletProvider');

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route 
            path="/dash" 
            element={isWalletConnected ? <Dashboard /> : <Navigate to="/dash" replace />} 
          />
          <Route 
            path="/history" 
            element={isWalletConnected ? <History /> : <Navigate to="/history" replace />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;