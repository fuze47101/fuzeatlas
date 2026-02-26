import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FabricDetailPage from '../FabricDetailPage';

beforeEach(() => {
  jest.spyOn(global, 'fetch');
});
afterEach(() => {
  global.fetch.mockRestore();
});

describe('FabricDetailPage', () => {
  it('renders fabric details, submissions, and tests', async () => {
    const mockFabric = {
      id: 'abc123',
      name: 'Performance Knit',
      description: 'A high-performing stretch fabric.',
      submissions: [
        { id: 's1', submitter: 'Alice', date: '2024-05-03' },
        { id: 's2', submitter: 'Bob', date: '2024-05-07' }
      ],
      tests: [
        { id: 't1', name: 'Shrinkage Test', status: 'Passed' },
        { id: 't2', name: 'Colorfastness', status: 'In Progress' }
      ]
    };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => mockFabric });

    render(
      <MemoryRouter initialEntries={[`/fabrics/abc123`]}>
        <Routes>
          <Route path="/fabrics/:fabricId" element={<FabricDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText(/Performance Knit/));
    expect(screen.getByText('Performance Knit')).toBeInTheDocument();
    expect(screen.getByText('A high-performing stretch fabric.')).toBeInTheDocument();
    expect(screen.getByText('Submission #s1')).toBeInTheDocument();
    expect(screen.getByText('Submission #s2')).toBeInTheDocument();
    expect(screen.getByText('Shrinkage Test')).toBeInTheDocument();
    expect(screen.getByText('Colorfastness')).toBeInTheDocument();
  });
});
