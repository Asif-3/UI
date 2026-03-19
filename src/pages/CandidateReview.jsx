import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Phone, BookOpen, Briefcase, Award, CheckCircle, ArrowLeft, Save, Loader2, MapPin, Linkedin, Github } from 'lucide-react';
import api from '../services/api';

const CandidateReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (location.state && location.state.candidateData) {
      setCandidate(location.state.candidateData);
      setLoading(false);
      return;
    }

    if (!id) {
      setLoading(false);
      return;
    }

    const fetchCandidate = async () => {
      try {
        // Since there might not be a direct endpoint for single candidate, fetch all and find
        const response = await api.get('/resume/candidates');
        const foundCandidate = response.data.find(c => c.id === id);

        if (foundCandidate) {
          setCandidate(foundCandidate);
        } else {
          console.error('Candidate not found in the list');
        }
      } catch (error) {
        console.error('Error fetching candidate:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidate();
  }, [id, location.state]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCandidate((prev) => ({ ...prev, [name]: value }));
  };

  const saveCandidate = async () => {
    setSaving(true);
    try {
      const formattedData = {
        ...candidate,
        skills: Array.isArray(candidate.skills)
          ? candidate.skills.join(', ')
          : candidate.skills
      };

      // Attempt to save to backend
      await api.put(`/resume/candidate/${id}`, formattedData);

      setIsEditing(false);
      showNotification('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving candidate:', error);
      // Fallback: update local state anyway to simulate success in UI
      setIsEditing(false);
      showNotification('Local preview updated (backend unavailable)', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      if (!id) {
        // New parsed candidate, need to save
        const response = await api.post('/resume/approve', candidate);
        const updatedCandidate = { ...response.data, status: 'Verified', verified: true };
        setCandidate(updatedCandidate);
        showNotification('Candidate Verified and Saved successfully!');

        // Remove from persistent pending reviews
        const saved = localStorage.getItem('pending_reviews');
        if (saved) {
          const pending = JSON.parse(saved);
          const filtered = pending.filter(p => p.email !== candidate.email);
          localStorage.setItem('pending_reviews', JSON.stringify(filtered));
        }

        setTimeout(() => navigate('/upload'), 1500);
      } else {
        await api.put(`/resume/candidate/${id}/verify`);

        const updatedCandidate = { ...candidate, status: 'Verified', verified: true };
        setCandidate(updatedCandidate);
        showNotification('Candidate Verified successfully!');
      }
    } catch (error) {
      console.error('Error approving candidate:', error);
      showNotification(error.response?.data?.message || 'Failed to verify candidate', 'error');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium">Loading candidate profile...</p>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Candidate Not Found</h2>
        <p className="text-gray-500 mb-6">The candidate you are looking for does not exist or has been removed.</p>
        <button onClick={() => navigate(-1)} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </button>

        {notification && (
          <div className={`px-4 py-2 rounded-lg shadow-sm text-sm font-medium animate-in fade-in slide-in-from-top-2 ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
            {notification.message}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Candidate Profile</h1>
          <p className="text-gray-500 mt-1">Review applicant details, verify records, and approve.</p>
        </div>
        <div className="flex items-center gap-3">
          {candidate.status !== 'Verified' && (
            <button
              onClick={handleApprove}
              disabled={approving || isEditing}
              className="px-4 py-2.5 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition flex items-center gap-2 font-medium disabled:opacity-75"
            >
              {approving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {approving ? 'Approving...' : 'Verify & Approve'}
            </button>
          )}

          {isEditing ? (
            <button
              onClick={saveCandidate}
              disabled={saving}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2 font-medium disabled:opacity-75"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg shadow hover:bg-gray-800 transition flex items-center gap-2 font-medium"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-6 relative">
          <div className="absolute top-6 right-6">
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full shadow-sm ${candidate.status === 'Verified' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              }`}>
              {candidate.status === 'Verified' && <CheckCircle className="w-4 h-4" />}
              {candidate.status || 'Pending'}
            </span>
          </div>

          <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-4xl shadow-lg border-4 border-white flex-shrink-0">
            {candidate.name?.charAt(0) || 'U'}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="space-y-4 max-w-lg mt-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={candidate.name}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Job Role / Headline</label>
                  <input
                    type="text"
                    name="jobRole"
                    value={candidate.jobRole}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-900 mt-2 text-center md:text-left">{candidate.name}</h2>
                <p className="text-lg font-medium text-blue-700 text-center md:text-left mt-1">{candidate.jobRole || 'Professional Role Unspecified'}</p>

                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-gray-600">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {candidate.email}
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {candidate.phone}
                  </div>
                  {candidate.location && (
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium">
                      <MapPin className="w-4 h-4 text-red-400" />
                      {candidate.location}
                    </div>
                  )}
                  {candidate.linkedin && (
                    <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium text-blue-600 hover:text-blue-800 transition">
                      <Linkedin className="w-4 h-4 text-blue-500" />
                      LinkedIn
                    </a>
                  )}
                  {candidate.github && (
                    <a href={candidate.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium text-gray-900 hover:text-gray-600 transition">
                      <Github className="w-4 h-4 text-gray-700" />
                      GitHub
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contact info edit block */}
        {isEditing && (
          <div className="grid md:grid-cols-2 gap-6 p-6 md:p-8 border-b border-gray-100 bg-gray-50/50">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><Mail className="w-4 h-4" /> Email Address</label>
              <input
                type="email"
                name="email"
                value={candidate.email}
                onChange={handleInputChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><Phone className="w-4 h-4" /> Phone Number</label>
              <input
                type="text"
                name="phone"
                value={candidate.phone}
                onChange={handleInputChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</label>
              <input
                type="text"
                name="location"
                value={candidate.location || ''}
                onChange={handleInputChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><Linkedin className="w-4 h-4" /> LinkedIn URL</label>
              <input
                type="url"
                name="linkedin"
                value={candidate.linkedin || ''}
                onChange={handleInputChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><Github className="w-4 h-4" /> GitHub URL</label>
              <input
                type="url"
                name="github"
                value={candidate.github || ''}
                onChange={handleInputChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
          {/* Left Column */}
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                <User className="w-5 h-5 text-blue-600" /> Skills & Expertise
              </h3>
              {isEditing ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Comma separated list</label>
                  <textarea
                    name="skills"
                    rows={3}
                    value={typeof candidate.skills === 'object' ? candidate.skills.join(', ') : candidate.skills}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(typeof candidate.skills === 'string' ? candidate.skills.split(',') : candidate.skills || []).map((skill, index) => (
                    <span key={index} className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md font-medium text-sm">
                      {typeof skill === 'string' ? skill.trim() : skill}
                    </span>
                  ))}
                  {(!candidate.skills || candidate.skills.length === 0) && (
                    <p className="text-gray-400 italic text-sm">No skills explicitly found.</p>
                  )}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                <BookOpen className="w-5 h-5 text-blue-600" /> Education
              </h3>
              {isEditing ? (
                <textarea
                  name="education"
                  rows={4}
                  value={candidate.education || ''}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {candidate.education || <span className="text-gray-400 italic">No education history extracted.</span>}
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                <Briefcase className="w-5 h-5 text-blue-600" /> Professional Experience
              </h3>
              {isEditing ? (
                <textarea
                  name="experience"
                  rows={6}
                  value={candidate.experience || ''}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {candidate.experience || <span className="text-gray-400 italic">No experience history extracted.</span>}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                <Award className="w-5 h-5 text-blue-600" /> Certifications
              </h3>
              {isEditing ? (
                <textarea
                  name="certifications"
                  rows={3}
                  value={candidate.certifications || ''}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {candidate.certifications || <span className="text-gray-400 italic">No certifications listed.</span>}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateReview;
