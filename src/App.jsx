import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadResume from './pages/UploadResume';
import CandidateReview from './pages/CandidateReview';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<UploadResume />} />
          <Route path="candidate/:id" element={<CandidateReview />} />
          <Route path="review" element={<CandidateReview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
