import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Briefcase, FileText, ChevronRight,
  Users, LayoutGrid, List, CheckCircle, Clock,
  Trash2, AlertTriangle, X, Mail, Phone, Calendar,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';

const formatDateTime = (isoStr) => {
  if (!isoStr) return '—';
  if (Array.isArray(isoStr)) {
    const [y, mo, d, h = 0, mi = 0] = isoStr;
    const dt = new Date(y, mo - 1, d, h, mi);
    return dt.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const getTimeMs = (isoStr) => {
  if (!isoStr) return 0;
  if (Array.isArray(isoStr)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = isoStr;
    return new Date(y, mo - 1, d, h, mi, s).getTime();
  }
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

// ── Confirm Dialog ──
const ConfirmDialog = ({ title, message, confirmLabel, confirmIcon, confirmColor, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          confirmColor === 'red' ? 'bg-red-100' : 'bg-blue-100'
        }`}>
          {confirmColor === 'red'
            ? <AlertTriangle className="w-5 h-5 text-red-600" />
            : <ShieldCheck className="w-5 h-5 text-blue-600" />
          }
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title || 'Confirm'}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition flex items-center gap-1.5 shadow-sm ${
            confirmColor === 'red'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmIcon}{confirmLabel || 'Confirm'}
        </button>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSkills, setFilterSkills] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortOrder, setSortOrder] = useState('latest');
  const [viewMode, setViewMode] = useState('table');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const { toasts, addToast, removeToast } = useToast();

  const fetchCandidates = async () => {
    try {
      const response = await api.get('/resume/candidates');
      setCandidates(response.data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      addToast('Failed to load candidates.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCandidates(); }, []);

  const approveCandidate = async (id) => {
    try {
      await api.put(`/resume/candidate/${id}/verify`);
      await fetchCandidates();
      addToast('Candidate verified successfully!', 'success');
    } catch (error) {
      console.error('Error approving candidate:', error);
      addToast(error.response?.data?.message || 'Failed to verify candidate.', 'error');
    }
  };



  // ── Bulk Verify ──
  const handleBulkVerify = () => {
    const count = selectedIds.size;
    setConfirmDialog({
      title: 'Bulk Verify',
      message: `Are you sure you want to verify ${count} selected candidate${count > 1 ? 's' : ''}?`,
      confirmLabel: 'Verify All',
      confirmIcon: <ShieldCheck className="w-4 h-4" />,
      confirmColor: 'blue',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await api.post('/resume/candidates/bulk-verify', Array.from(selectedIds));
          const results = response.data;
          const successCount = results.filter(r => r.status === 'SUCCESS').length;
          const failedCount = results.filter(r => r.status === 'FAILED').length;

          if (successCount > 0) {
            addToast(`${successCount} candidate${successCount > 1 ? 's' : ''} verified!`, 'success');
          }
          if (failedCount > 0) {
            const failures = results.filter(r => r.status === 'FAILED');
            failures.forEach(f => {
              addToast(`Verify failed: ${f.reason}`, 'warning');
            });
          }

          setSelectedIds(new Set());
          await fetchCandidates();
        } catch (err) {
          console.error('Bulk verify error:', err);
          addToast('Failed to verify selected candidates.', 'error');
        }
      },
    });
  };

  // ── Bulk Delete ──
  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmDialog({
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete ${count} selected candidate${count > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      confirmIcon: <Trash2 className="w-4 h-4" />,
      confirmColor: 'red',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.delete('/resume/candidates/bulk', { data: Array.from(selectedIds) });
          setSelectedIds(new Set());
          await fetchCandidates();
          addToast(`${count} candidate${count > 1 ? 's' : ''} deleted successfully.`, 'success');
        } catch (err) {
          console.error('Bulk delete error:', err);
          addToast('Failed to delete selected candidates.', 'error');
        }
      },
    });
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch =
      candidate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.jobRole?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSkills =
      filterSkills === '' ||
      (Array.isArray(candidate.skills)
        ? candidate.skills.some(s => s.toLowerCase().includes(filterSkills.toLowerCase()))
        : candidate.skills?.toLowerCase().includes(filterSkills.toLowerCase()));
    const candStatus =
      candidate.status && candidate.status.toLowerCase() === 'verified'
        ? 'Verified'
        : 'Pending';
    const matchesStatus = filterStatus === 'All' || candStatus === filterStatus;
    return matchesSearch && matchesSkills && matchesStatus;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    const timeA = getTimeMs(a.verifiedAt || a.uploadedAt);
    const timeB = getTimeMs(b.verifiedAt || b.uploadedAt);
    return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
  });

  const totalPages = Math.ceil(sortedCandidates.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCandidates = sortedCandidates.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterSkills, filterStatus]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const allFilteredSelected =
    sortedCandidates.length > 0 &&
    sortedCandidates.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered candidates
      setSelectedIds(prev => {
        const s = new Set(prev);
        sortedCandidates.forEach(c => s.delete(c.id));
        return s;
      });
    } else {
      // Select all filtered candidates (across ALL pages)
      setSelectedIds(prev => {
        const s = new Set(prev);
        sortedCandidates.forEach(c => s.add(c.id));
        return s;
      });
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmIcon={confirmDialog.confirmIcon}
          confirmColor={confirmDialog.confirmColor}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Recruitment Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage and review candidates from parsed resumes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition inline-flex items-center font-medium text-sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Upload Resumes
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-sm"
              placeholder="Search by name, role, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <input
              type="text"
              className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-sm"
              placeholder="Filter by skill..."
              value={filterSkills}
              onChange={(e) => setFilterSkills(e.target.value)}
            />
          </div>
          <div className="sm:w-36">
            <select
              className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-sm text-gray-700"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
          <div className="sm:w-40">
            <select
              className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-sm text-gray-700"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} candidate{selectedIds.size > 1 ? 's' : ''} selected
              </span>


              {/* Bulk Verify button */}
              <button
                onClick={handleBulkVerify}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verify Selected
              </button>

              {/* Bulk Delete button */}
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-gray-400 hover:text-gray-600 transition"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">
              {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''} found
            </span>
          )}

          <div className="flex items-center bg-gray-100 p-1 rounded-lg shrink-0 ml-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md flex items-center transition ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md flex items-center transition ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No candidates found</h3>
              <p className="text-gray-500 mt-1">Try adjusting filters or upload more resumes.</p>
            </div>

          ) : viewMode === 'table' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                          title={`Select all ${sortedCandidates.length} candidates`}
                        />
                      </th>
                      <th className="p-4">Candidate</th>
                      <th className="p-4 hidden md:table-cell">Contact</th>
                      <th className="p-4 hidden lg:table-cell">Skills</th>
                      <th className="p-4 hidden xl:table-cell">Education / Experience</th>
                      <th className="p-4 hidden lg:table-cell">Date</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentCandidates.map(candidate => (
                      <tr
                        key={candidate.id}
                        className={`hover:bg-gray-50 transition ${selectedIds.has(candidate.id) ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(candidate.id)}
                            onChange={() => toggleSelect(candidate.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                          />
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0">
                              {candidate.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{candidate.name}</div>
                              <div className="text-xs text-gray-500">{candidate.jobRole || 'Unspecified Role'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-sm text-gray-600 hidden md:table-cell">
                          <div className="truncate max-w-[160px]">{candidate.email}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{candidate.phone}</div>
                          <div className="text-gray-400 text-xs">{candidate.location || "Location Not Specified"}</div>
                        </td>

                        <td className="p-4 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {Array.isArray(candidate.skills)
                              ? candidate.skills.slice(0, 3).map((skill, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded truncate max-w-[90px]">{skill}</span>
                              ))
                              : typeof candidate.skills === 'string' && candidate.skills.split(',').slice(0, 3).map((skill, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded truncate max-w-[90px]">{skill.trim()}</span>
                              ))
                            }
                            {((Array.isArray(candidate.skills) ? candidate.skills.length : typeof candidate.skills === 'string' ? candidate.skills.split(',').length : 0) > 3) && (
                              <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded border border-gray-200">...</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-sm hidden xl:table-cell">
                          <div className="text-gray-800 line-clamp-1 truncate max-w-[180px]" title={candidate.education}>
                            <span className="font-medium text-gray-500">Ed:</span> {candidate.education || 'N/A'}
                          </div>
                          <div className="text-gray-800 text-xs mt-1 line-clamp-1 truncate max-w-[180px]" title={candidate.experience}>
                            <span className="font-medium text-gray-500">Exp:</span> {candidate.experience || 'N/A'}
                          </div>
                        </td>

                        <td className="p-4 hidden lg:table-cell">
                          <div className="text-xs text-gray-500 flex flex-col gap-1">
                            {candidate.verifiedAt && <span title="Verified At"><Calendar className="w-3 h-3 inline mr-1 text-green-500"/>{formatDateTime(candidate.verifiedAt)}</span>}
                            {candidate.uploadedAt && <span title="Uploaded At"><Calendar className="w-3 h-3 inline mr-1 text-blue-500"/>{formatDateTime(candidate.uploadedAt)}</span>}
                            {!candidate.verifiedAt && !candidate.uploadedAt && <span>—</span>}
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${candidate.status === 'Verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {candidate.status === 'Verified' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {candidate.status === 'Verified' ? 'Verified' : 'Pending'}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {candidate.status !== 'Verified' && (
                              <button
                                onClick={() => approveCandidate(candidate.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center shadow-sm whitespace-nowrap"
                              >
                                Approve
                              </button>
                            )}
                            <Link
                              to={`/candidate/${candidate.id}`}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center whitespace-nowrap"
                            >
                              Review <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`bg-white rounded-xl p-5 shadow-sm border transition duration-200 flex flex-col h-full relative ${selectedIds.has(candidate.id) ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100 hover:shadow-md'
                    }`}
                >
                  <div className="absolute top-3 left-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => toggleSelect(candidate.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="flex justify-between items-start mb-4 pt-1 pl-6 pr-1">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-200 shrink-0">
                      {candidate.name?.charAt(0) || 'U'}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${candidate.status === 'Verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {candidate.status === 'Verified' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {candidate.status === 'Verified' ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-base font-bold text-gray-900 leading-tight">{candidate.name}</h3>
                    <p className="text-sm text-blue-600 font-medium mb-2">{candidate.jobRole || 'Unspecified Role'}</p>
                    {candidate.uploadedAt && (
                      <div className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDateTime(candidate.verifiedAt || candidate.uploadedAt)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{candidate.email}</span></div>
                      <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{candidate.phone}</span></div>
                      <div className="flex items-center gap-1.5 text-gray-600 font-medium"><MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" /><span>{candidate.location || "Location Not Specified"}</span></div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-50">
                    <div className="flex flex-wrap gap-1.5 mb-4 max-h-[48px] overflow-hidden">
                      {Array.isArray(candidate.skills)
                        ? candidate.skills.slice(0, 4).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium truncate max-w-[110px]">{skill}</span>
                        ))
                        : typeof candidate.skills === 'string' && candidate.skills.split(',').slice(0, 4).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium truncate max-w-[110px]">{skill.trim()}</span>
                        ))
                      }
                      {((Array.isArray(candidate.skills) ? candidate.skills.length : typeof candidate.skills === 'string' ? candidate.skills.split(',').length : 0) > 4) && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded border border-gray-200">+more</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {candidate.status !== 'Verified' && (
                        <button
                          onClick={() => approveCandidate(candidate.id)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition shadow-sm"
                        >
                          Approve
                        </button>
                      )}
                      <Link
                        to={`/candidate/${candidate.id}`}
                        className="flex-1 text-center py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-medium rounded-lg transition"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-gray-900">{Math.min(indexOfLastItem, filteredCandidates.length)}</span> of <span className="font-medium text-gray-900">{filteredCandidates.length}</span> candidates
              </span>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
