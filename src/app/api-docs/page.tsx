'use client';

import { useState, useMemo } from 'react';
import { apiDocumentation, searchEndpoints, type ApiEndpoint } from '@/lib/api-docs';

export default function ApiDocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(apiDocumentation.map(g => g.group))
  );
  const [methodFilter, setMethodFilter] = useState<string>('');

  const filteredDocs = useMemo(() => {
    if (!searchQuery && !methodFilter) {
      return apiDocumentation;
    }

    let results = apiDocumentation.map(group => ({
      ...group,
      endpoints: group.endpoints.filter(ep => {
        const matchesSearch = !searchQuery ||
          ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesMethod = !methodFilter || ep.method === methodFilter;

        return matchesSearch && matchesMethod;
      }),
    })).filter(group => group.endpoints.length > 0);

    return results;
  }, [searchQuery, methodFilter]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === filteredDocs.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(filteredDocs.map(g => g.group)));
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-800';
      case 'POST':
        return 'bg-blue-100 text-blue-800';
      case 'PUT':
        return 'bg-orange-100 text-orange-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'PATCH':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const allEndpoints = apiDocumentation.flatMap(g => g.endpoints);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">API Documentation</h1>
          <p className="text-lg text-gray-600">FUZE Atlas API Reference</p>

          {/* Auth Note */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Authentication:</strong> All endpoints except <code className="bg-blue-100 px-2 py-1 rounded">/api/auth/*</code> require a valid JWT session cookie.
            </p>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-8 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search endpoints by path or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMethodFilter('')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                methodFilter === ''
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              All Methods
            </button>
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
              <button
                key={method}
                onClick={() => setMethodFilter(methodFilter === method ? '' : method)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  methodFilter === method
                    ? getMethodColor(method) + ' ring-2 ring-offset-2'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{filteredDocs.reduce((sum, g) => sum + g.endpoints.length, 0)}</strong> of{' '}
              <strong>{allEndpoints.length}</strong> endpoints
            </p>
            <button
              onClick={toggleAllGroups}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {expandedGroups.size === filteredDocs.length ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        {/* API Groups */}
        <div className="space-y-4">
          {filteredDocs.map(group => (
            <div
              key={group.group}
              className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.group)}
                className="w-full px-6 py-4 bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 flex items-center justify-between transition-colors"
              >
                <div className="text-left">
                  <h2 className="text-xl font-bold text-gray-900">{group.group}</h2>
                  <p className="text-sm text-gray-600">{group.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="bg-gray-300 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                    {group.endpoints.length}
                  </span>
                  <svg
                    className={`w-6 h-6 text-gray-600 transition-transform ${
                      expandedGroups.has(group.group) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </button>

              {/* Endpoints List */}
              {expandedGroups.has(group.group) && (
                <div className="divide-y divide-gray-200">
                  {group.endpoints.map((endpoint, idx) => (
                    <EndpointItem key={`${group.group}-${idx}`} endpoint={endpoint} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* No Results Message */}
        {filteredDocs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No endpoints found matching your search.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setMethodFilter('');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium mt-4"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-300 text-center text-gray-600 text-sm">
          <p>FUZE Atlas API Documentation - Last updated {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

function EndpointItem({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(false);

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-800';
      case 'POST':
        return 'bg-blue-100 text-blue-800';
      case 'PUT':
        return 'bg-orange-100 text-orange-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'PATCH':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAuthBadge = (auth: string) => {
    switch (auth) {
      case 'public':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'user':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'admin':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="px-6 py-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left hover:bg-gray-50 p-3 -mx-3 rounded transition-colors"
      >
        <div className="flex items-start gap-4">
          <span className={`px-3 py-1 rounded font-bold text-sm whitespace-nowrap flex-shrink-0 ${getMethodColor(endpoint.method)}`}>
            {endpoint.method}
          </span>
          <div className="flex-grow min-w-0">
            <p className="font-mono text-sm text-gray-900 break-all">{endpoint.path}</p>
            <p className="text-gray-700 text-sm mt-1">{endpoint.description}</p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 mt-1 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 ml-3 space-y-3 border-l-2 border-gray-300 pl-4">
          {/* Auth */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Authentication</p>
            <span className={`inline-block px-3 py-1 rounded border text-sm font-medium ${getAuthBadge(endpoint.auth)}`}>
              {endpoint.auth.toUpperCase()}
            </span>
          </div>

          {/* Request Body */}
          {endpoint.requestBody && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Request Body</p>
              <code className="bg-gray-100 text-gray-900 px-3 py-2 rounded block text-xs font-mono">
                {endpoint.requestBody}
              </code>
            </div>
          )}

          {/* Response */}
          {endpoint.response && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Response</p>
              <code className="bg-gray-100 text-gray-900 px-3 py-2 rounded block text-xs font-mono">
                {endpoint.response}
              </code>
            </div>
          )}

          {/* Notes */}
          {endpoint.notes && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                {endpoint.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
