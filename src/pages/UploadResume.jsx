import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, X, CheckCircle, File, AlertCircle,
  Clock, Trash2, RefreshCw, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Helper: format ISO date string to readable "DD MMM YYYY, HH:MM AM/PM"
const formatDateTime = (isoStr) => {
  if (!isoStr) return '—';
  // Java LocalDateTime comes as [2025,3,17,10,30,0] array OR ISO string
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

// Status badge component
const StatusBadge = ({ status }) => {
  const map = {
    Pending: { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
    Verified: { cls: 'bg-green-100  text-green-800  border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
    Deleted: { cls: 'bg-red-100    text-red-700    border-red-200', icon: <Trash2 className="w-3 h-3" /> },
  };
  const cfg = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
      {cfg.icon}{status}
    </span>
  );
};

const UploadResume = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Pending resumes fetched from DB
  const [pendingResumes, setPendingResumes] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [sortOrder, setSortOrder] = useState('latest');

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // ---- fetch pending resumes from backend ----
  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await api.get('/resume/pending');
      setPendingResumes((res.data || []).filter(r => r.status !== 'Deleted'));
    } catch (err) {
      console.error('Failed to load pending resumes:', err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // ---- file selection ----
  const validateAndAdd = (selected) => {
    const validFiles = selected.filter(f =>
      f.type === 'application/pdf' ||
      f.name.endsWith('.doc') ||
      f.name.endsWith('.docx')
    );
    if (validFiles.length !== selected.length) {
      setErrorMessage('Some files were rejected. Only PDF, DOC, and DOCX are supported.');
      setUploadStatus('error');
    } else {
      setErrorMessage('');
      setUploadStatus(null);
    }
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleFileChange = (e) => validateAndAdd(Array.from(e.target.files));

  const removeFile = (i) => setFiles(files.filter((_, idx) => idx !== i));

  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) validateAndAdd(Array.from(e.dataTransfer.files));
  };

  // ---- upload & parse ----
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadStatus(null);
    setErrorMessage('');

    const formData = new FormData();
    for (let file of files) formData.append('file', file);

    try {
      await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('success');
      setFiles([]);
      await fetchPending();
    } catch (error) {
      console.error('Upload Error:', error);
      setUploadStatus('error');
      setErrorMessage(
        error.response?.data?.message ||
        'Failed to upload resumes. Please ensure the backend is running and try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  // ---- verify a pending resume ----
  const handleVerify = async (id) => {
    try {
      await api.post(`/resume/verify/${id}`);
      alert('Resume verified and moved to dashboard successfully.');
      await fetchPending();
    } catch (err) {
      console.error('Verify error:', err);
      // Give a highly specific error message so we know if it's a 404/405 (Not Restarted) or an actual DB error
      if (err.response?.status === 404 || err.response?.status === 405) {
         alert('API Error (' + err.response.status + '): The Verification endpoint was not found. Have you restarted the Spring Boot backend server after the recent changes?');
      } else {
         const backendMsg = err.response?.data?.message;
         alert(backendMsg ? backendMsg : 'Verification failed due to a server error. Please check the backend console.');
      }
    }
  };

  // ---- soft-delete a pending resume ----
  const handleDelete = async (id) => {
    if (!window.confirm('Remove this pending resume?')) return;
    try {
      await api.delete(`/resume/pending/${id}`);
      await fetchPending();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  const sortedPending = [...pendingResumes].sort((a, b) => {
    const timeA = getTimeMs(a.uploadedAt);
    const timeB = getTimeMs(b.uploadedAt);
    return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Resumes</h1>
        <p className="text-gray-500 mt-1">Select or drag-and-drop candidate resumes for parsing.</p>
      </div>

      {/* Drop zone */}
      <div
        className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-300 p-10 flex flex-col items-center justify-center transition hover:bg-gray-50 cursor-pointer"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <Upload className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Click or drag files to upload</h3>
        <p className="text-sm text-gray-500 mb-6">Supported formats: PDF, DOC, DOCX (Max 10 MB per file)</p>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <button className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition shadow-sm">
          Browse Files
        </button>
      </div>

      {/* Error alert */}
      {uploadStatus === 'error' && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex flex-col gap-1 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <h4 className="font-semibold">Upload Failed</h4>
          </div>
          <p className="text-sm ml-7">{errorMessage}</p>
        </div>
      )}

      {/* Success banner */}
      {uploadStatus === 'success' && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold text-sm">Resumes uploaded and saved as Pending! Review them below.</span>
        </div>
      )}

      {/* Selected files list (before upload) */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-800">Selected Files ({files.length})</h3>
            <button onClick={() => setFiles([])} className="text-sm text-red-600 hover:text-red-800 font-medium">
              Clear All
            </button>
          </div>
          <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <li key={index} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading &amp; Parsing...
                </>
              ) : (
                'Upload & Parse Resumes'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Pending Resumes Section                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-gray-800">
              Uploaded Resumes — Pending Review
            </h3>
            <span className="ml-1 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
              {pendingResumes.filter(r => r.status === 'Pending').length} pending
            </span>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
            <button
              onClick={fetchPending}
              title="Refresh"
              className="text-gray-400 hover:text-blue-600 transition p-1"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingPending ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : pendingResumes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <File className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No pending resumes yet. Upload some above!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Uploaded At</span>
                  </th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedPending.map((resume) => (
                  <tr key={resume.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0">
                          {resume.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{resume.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{resume.location || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-gray-700 truncate max-w-[160px]">{resume.email || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{resume.phone || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-blue-600 font-medium">{resume.jobRole || 'N/A'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-500">{formatDateTime(resume.uploadedAt)}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={resume.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {resume.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleVerify(resume.id)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition shadow-sm"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => navigate('/review', { state: { candidateData: resume } })}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium rounded-lg transition"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleDelete(resume.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {resume.status === 'Verified' && (
                          <span className="text-xs text-green-600 font-medium">✓ Moved to Dashboard</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadResume;
