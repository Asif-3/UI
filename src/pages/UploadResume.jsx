import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, X, CheckCircle, File, AlertCircle,
  Clock, Trash2, RefreshCw, Calendar, AlertTriangle,
  FileWarning, Copy, Info, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';

// ── Format date helper ──
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

// ── Allowed file types ──
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const isValidFile = (file) => {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
};

// ── Status Badge ──
const StatusBadge = ({ status }) => {
  const map = {
    Pending:  { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
    Verified: { cls: 'bg-green-100  text-green-800  border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
    Deleted:  { cls: 'bg-red-100    text-red-700    border-red-200',   icon: <Trash2 className="w-3 h-3" /> },
  };
  const cfg = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
      {cfg.icon}{status}
    </span>
  );
};

// ── Confirm Dialog (custom, no browser confirm) ──
const ConfirmDialog = ({ title, message, confirmLabel, confirmIcon, confirmColor = 'red', onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 animate-in">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          confirmColor === 'red' ? 'bg-red-100' : 'bg-blue-100'
        }`}>
          {confirmColor === 'red' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <ShieldCheck className="w-5 h-5 text-blue-600" />}
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title || 'Confirm Action'}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
          Cancel
        </button>
        <button onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition flex items-center gap-1.5 shadow-sm ${
            confirmColor === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {confirmIcon || <Trash2 className="w-4 h-4" />} {confirmLabel || 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ── Upload Result Badge ──
const ResultBadge = ({ status }) => {
  const map = {
    SUCCESS:   { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Success' },
    DUPLICATE: { cls: 'bg-amber-100 text-amber-800 border-amber-200',       icon: <Copy className="w-3 h-3" />,        label: 'Duplicate' },
    INVALID:   { cls: 'bg-red-100 text-red-700 border-red-200',             icon: <FileWarning className="w-3 h-3" />,  label: 'Invalid' },
    ERROR:     { cls: 'bg-red-100 text-red-700 border-red-200',             icon: <AlertCircle className="w-3 h-3" />,  label: 'Error' },
  };
  const cfg = map[status] || map.ERROR;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};


const UploadResume = () => {
  const [files, setFiles] = useState([]);
  const [invalidFiles, setInvalidFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  // ── File selection with validation ──
  const validateAndAdd = (selected) => {
    const valid = [];
    const invalid = [];

    selected.forEach(f => {
      if (isValidFile(f)) {
        valid.push(f);
      } else {
        invalid.push({ name: f.name, reason: 'Unsupported format. Only PDF, DOC, DOCX allowed.' });
      }
    });

    if (invalid.length > 0) {
      setInvalidFiles(prev => [...prev, ...invalid]);
      addToast(
        `${invalid.length} file${invalid.length > 1 ? 's' : ''} rejected — unsupported format.`,
        'warning'
      );
    }

    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
    }
  };

  const handleFileChange = (e) => {
    validateAndAdd(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (i) => setFiles(files.filter((_, idx) => idx !== i));
  const clearInvalid = () => setInvalidFiles([]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length > 0) validateAndAdd(Array.from(e.dataTransfer.files));
  };

  // ── Upload & Parse ──
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadResults(null);

    const formData = new FormData();
    for (let file of files) formData.append('file', file);

    try {
      const response = await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = response.data;
      setUploadResults(data);
      setFiles([]);

      // Show summary toast
      const { successCount = 0, duplicateCount = 0, invalidCount = 0, errorCount = 0 } = data;

      if (successCount > 0) {
        addToast(`${successCount} resume${successCount > 1 ? 's' : ''} uploaded successfully!`, 'success');
      }
      if (duplicateCount > 0) {
        addToast(`${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} detected and skipped.`, 'warning');
      }
      if (invalidCount > 0) {
        addToast(`${invalidCount} file${invalidCount > 1 ? 's' : ''} had invalid format.`, 'error');
      }
      if (errorCount > 0) {
        addToast(`${errorCount} file${errorCount > 1 ? 's' : ''} failed to process.`, 'error');
      }

      // Log to backend
      try {
        await api.post('/resume/log', {
          level: 'INFO',
          source: 'UploadResume',
          message: `Upload completed: ${successCount} success, ${duplicateCount} duplicates, ${invalidCount} invalid, ${errorCount} errors`
        });
      } catch (_) { /* silent */ }


    } catch (error) {
      console.error('Upload Error:', error);
      addToast(
        error.response?.data?.message || 'Failed to upload resumes. Please ensure the backend is running.',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const successResults  = uploadResults?.results?.filter(r => r.status === 'SUCCESS')   || [];
  const duplicateResults = uploadResults?.results?.filter(r => r.status === 'DUPLICATE') || [];
  const invalidResults  = uploadResults?.results?.filter(r => r.status === 'INVALID')   || [];
  const errorResults    = uploadResults?.results?.filter(r => r.status === 'ERROR')     || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Page heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Resumes</h1>
        <p className="text-gray-500 mt-1">Select or drag-and-drop candidate resumes for parsing.</p>
      </div>

      {/* Bulk upload info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-blue-800">Bulk Upload Available</h4>
          <p className="text-xs text-blue-600 mt-0.5">
            You can select and upload multiple resume files at once. Supported formats: <strong>PDF, DOC, DOCX</strong>.
            Each file will be validated, parsed, and checked for duplicates automatically.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`bg-white rounded-2xl shadow-sm border-2 border-dashed p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
          dragOver
            ? 'border-blue-400 bg-blue-50 scale-[1.01]'
            : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
          dragOver ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-600'
        }`}>
          <Upload className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          {dragOver ? 'Drop files here...' : 'Click or drag files to upload'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Supported: PDF, DOC, DOCX &nbsp;·&nbsp; Max 5 MB per file &nbsp;·&nbsp; Multiple files supported
        </p>
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

      {/* ── Invalid Files Panel ── */}
      {invalidFiles.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-200 flex justify-between items-center bg-red-100/50">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-red-800 text-sm">
                Invalid Files ({invalidFiles.length})
              </h3>
            </div>
            <button onClick={clearInvalid} className="text-xs text-red-600 hover:text-red-800 font-medium">
              Dismiss
            </button>
          </div>
          <ul className="divide-y divide-red-100">
            {invalidFiles.map((f, i) => (
              <li key={i} className="px-5 py-2.5 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800 truncate">{f.name}</p>
                  <p className="text-xs text-red-500">{f.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Selected Files List ── */}
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
                <>
                  <Upload className="w-4 h-4" />
                  Upload &amp; Parse ({files.length} file{files.length > 1 ? 's' : ''})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* UPLOAD RESULTS PANEL                                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {uploadResults && uploadResults.results && uploadResults.results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Upload Results</h3>
            <button
              onClick={() => setUploadResults(null)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Dismiss
            </button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-emerald-700">{uploadResults.successCount || 0}</p>
                <p className="text-xs text-emerald-600">Uploaded</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-3">
              <Copy className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-lg font-bold text-amber-700">{uploadResults.duplicateCount || 0}</p>
                <p className="text-xs text-amber-600">Duplicates</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-red-50 rounded-lg p-3">
              <FileWarning className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-lg font-bold text-red-700">{uploadResults.invalidCount || 0}</p>
                <p className="text-xs text-red-600">Invalid</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <AlertCircle className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-lg font-bold text-gray-700">{uploadResults.errorCount || 0}</p>
                <p className="text-xs text-gray-600">Errors</p>
              </div>
            </div>
          </div>

          {/* Per-file results */}
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {/* Success */}
            {successResults.map((r, i) => (
              <div key={`s-${i}`} className="px-6 py-3 flex items-center gap-3 bg-emerald-50/30">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.fileName}</p>
                  <p className="text-xs text-emerald-600">{r.reason}</p>
                </div>
                <ResultBadge status="SUCCESS" />
              </div>
            ))}

            {/* Duplicates */}
            {duplicateResults.map((r, i) => (
              <div key={`d-${i}`} className="px-6 py-3 flex items-center gap-3 bg-amber-50/30">
                <Copy className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.fileName}</p>
                  <p className="text-xs text-amber-600">{r.reason}</p>
                </div>
                <ResultBadge status="DUPLICATE" />
              </div>
            ))}

            {/* Invalid */}
            {invalidResults.map((r, i) => (
              <div key={`i-${i}`} className="px-6 py-3 flex items-center gap-3 bg-red-50/30">
                <FileWarning className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.fileName}</p>
                  <p className="text-xs text-red-500">{r.reason}</p>
                </div>
                <ResultBadge status="INVALID" />
              </div>
            ))}

            {/* Errors */}
            {errorResults.map((r, i) => (
              <div key={`e-${i}`} className="px-6 py-3 flex items-center gap-3 bg-red-50/30">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.fileName}</p>
                  <p className="text-xs text-red-500">{r.reason}</p>
                </div>
                <ResultBadge status="ERROR" />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default UploadResume;
