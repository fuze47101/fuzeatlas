import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FabricDetailPage from './pages/FabricDetailPage';
// import SubmissionDetailPage from './pages/SubmissionDetailPage';
// import TestDetailPage from './pages/TestDetailPage';

const AppRoutes = () => (
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fabrics/:fabricId" element={<FabricDetailPage />} />
      {/* <Route path="/submissions/:submissionId" element={<SubmissionDetailPage />} /> */}
      {/* <Route path="/tests/:testId" element={<TestDetailPage />} /> */}
    </Routes>
  </Router>
);

export default AppRoutes;
