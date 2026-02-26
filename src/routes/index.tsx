import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import FabricDetailPage from '../pages/FabricDetailPage';
// import other pages as needed

const AppRoutes = () => (
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fabrics/:fabricId" element={<FabricDetailPage />} />
      {/* other routes */}
    </Routes>
  </Router>
);

export default AppRoutes;
