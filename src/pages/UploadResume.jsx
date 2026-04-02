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

// ── File validation constants ──
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

const isValidFileFormat = (file) => {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
};

const isValidFileSize = (file) => {
  return file.size <= MAX_FILE_SIZE;
};

const isValidFile = (file) => {
  return isValidFileFormat(file) && isValidFileSize(file);
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
  const [oversizedFiles, setOversizedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [errorData, setErrorData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  // ── File selection with validation ──
  const validateAndAdd = (selected) => {
    const valid = [];
    const invalid = [];
    const oversized = [];

    selected.forEach(f => {
      if (!isValidFileFormat(f)) {
        invalid.push({ name: f.name, reason: 'Unsupported format. Only PDF, DOC, DOCX allowed.' });
      } else if (!isValidFileSize(f)) {
        const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
        oversized.push({ name: f.name, sizeMB, reason: `File exceeds 5MB limit (${sizeMB} MB)` });
      } else {
        valid.push(f);
      }
    });

    // Handle oversized files
    if (oversized.length > 0) {
      setOversizedFiles(prev => [...prev, ...oversized]);
      
      if (oversized.length === 1 && selected.length === 1) {
        // Single oversized file only
        addToast(
          `⚠ File Skipped: "${oversized[0].name}" (${oversized[0].sizeMB} MB) exceeds 5MB limit`,
          'warning'
        );
      } else if (valid.length === 0) {
        // All files are oversized
        addToast(
          `⚠ ${oversized.length} file${oversized.length > 1 ? 's' : ''} skipped — all exceed 5MB limit`,
          'warning'
        );
      } else {
        // Mixed: some valid, some oversized
        addToast(
          `⚠ ${oversized.length} file${oversized.length > 1 ? 's' : ''} skipped — exceeds 5MB limit`,
          'warning'
        );
      }
    }

    // Handle invalid format files
    if (invalid.length > 0) {
      setInvalidFiles(prev => [...prev, ...invalid]);
      addToast(
        `❌ ${invalid.length} file${invalid.length > 1 ? 's' : ''} rejected — unsupported format`,
        'error'
      );
    }

    // Add valid files
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
  const clearOversized = () => setOversizedFiles([]);

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
    setErrorData(null);
    setError(null);

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
        addToast(`✅ ${successCount} resume${successCount > 1 ? 's' : ''} uploaded successfully!`, 'success');
      }
      if (duplicateCount > 0) {
        addToast(`⚠ ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} detected and skipped.`, 'warning');
      }
      if (invalidCount > 0) {
        addToast(`❌ ${invalidCount} file${invalidCount > 1 ? 's' : ''} had invalid format.`, 'error');
      }
      if (errorCount > 0) {
        addToast(`❌ ${errorCount} file${errorCount > 1 ? 's' : ''} failed to process.`, 'error');
      }

      // Log to backend
      try {
        await api.post('/resume/log', {
          level: 'INFO',
          source: 'UploadResume',
          message: `Upload completed: ${successCount} success, ${duplicateCount} duplicates, ${invalidCount} invalid, ${errorCount} errors`
        });
      } catch (_) { /* silent */ }

    } catch (err) {
      console.error('Upload Error:', err);
      const data = err.response?.data;
      
      const failedCount = files.length;
      let errorReason = null;

      if (data && data.status === 'ERROR' && data.message === 'Database connection lost. Data not saved.') {
        errorReason = '❌ Database connection lost. Data not saved.';
      } else if (!err.response) {
        errorReason = '❌ Server not reachable. Backend or Database is down.';
      } else if (err.response.status >= 500) {
        errorReason = `❌ Internal Server Error (${err.response.status}). Data not saved.`;
      }

      if (errorReason && failedCount > 0) {
        const failedResults = files.map(file => ({
          fileName: file.name,
          status: 'ERROR',
          reason: errorReason
        }));
        
        setFiles([]);
        setUploadResults({
          successCount: 0,
          duplicateCount: 0,
          invalidCount: 0,
          errorCount: failedCount,
          results: failedResults
        });
        setErrorData(null);
        setError(null);
        addToast(`❌ ${failedCount} file${failedCount > 1 ? 's' : ''} failed to process.`, 'error');
      } else if (data && data.status === 'error') {
        setErrorData(data);
        setError(null);
      } else {
        setErrorData(null);
        setError(data?.message || err.message || 'Server not reachable');
      }
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

      {/* ── Oversized Files Panel ── */}
      {oversizedFiles.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex justify-between items-center bg-amber-100/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-amber-800 text-sm">
                ⚠ Oversized Files ({oversizedFiles.length})
              </h3>
            </div>
            <button onClick={clearOversized} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
              Dismiss
            </button>
          </div>
          <ul className="divide-y divide-amber-100">
            {oversizedFiles.map((f, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <p className="text-sm font-medium text-amber-900">{f.name}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-7 text-xs text-amber-700">
                    <span className="text-base">📦</span>
                    Size: <span className="font-semibold">{f.sizeMB} MB</span>
                  </div>
                  <div className="flex items-center gap-2 ml-7 text-xs text-red-600 mt-1">
                    <span className="text-base">❌</span>
                    The given file is not within the allowed size limit (Max: 5MB)
                  </div>
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
                <p className="text-lg font-bold text-red-700">
                  {(uploadResults.invalidCount || 0) + invalidFiles.length + oversizedFiles.length}
                </p>
                <p className="text-xs text-red-600">Invalid</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <AlertCircle className="w-5 h-5 text-gray-500" />
              <p className="text-lg font-bold text-gray-700">
                {(uploadResults.errorCount || 0) + (error ? 1 : 0) + (errorData ? 1 : 0)}
              </p>
              <p className="text-xs text-gray-600">
                {((uploadResults.errorCount || 0) + (error ? 1 : 0) + (errorData ? 1 : 0)) === 1 ? 'Error' : 'Errors'}
              </p>
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ERROR PANEL                                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      {(errorData || error) && (
        <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 bg-red-100/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">Upload Failed</h3>
            </div>
            <button
              onClick={() => { setErrorData(null); setError(null); }}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Dismiss
            </button>
          </div>
          
          {errorData ? (
            <div className="p-6 space-y-4">
              {errorData.message && (
                <p className="text-sm font-medium text-red-800">{errorData.message}</p>
              )}
              
              {/* Files List */}
              {errorData.files && errorData.files.length > 0 && (
                <div className="space-y-4 mt-4">
                  {errorData.files.map((file, idx) => (
                    <div key={idx} className="bg-white border border-red-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm">
                        <span className="text-lg">📄</span>
                        {file.file_name}
                      </div>
                      <div className="text-sm text-gray-700 ml-7 flex items-center gap-2">
                        <span className="text-base">📦</span>
                        <span className="font-semibold text-gray-900">Size:</span> {file.size_mb} MB
                      </div>
                      <div className="text-sm text-red-700 ml-7 flex items-center gap-2">
                        <span className="text-base">❌</span>
                        <span className="font-semibold">Reason:</span> {file.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Largest File Highlight */}
              {errorData.largest_file && (
                <div className="mt-6 bg-red-100 border-2 border-red-300 rounded-lg p-4 flex items-start gap-4 shadow-sm">
                  <span className="text-2xl mt-0.5">🚨</span>
                  <div>
                    <h4 className="text-sm font-bold text-red-900 uppercase tracking-wide">Largest File</h4>
                    <p className="text-sm text-red-800 mt-1 font-medium">
                      {errorData.largest_file.file_name} <span className="opacity-80">({errorData.largest_file.size_mb} MB)</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default UploadResume;