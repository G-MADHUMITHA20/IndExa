import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Edit3,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
} from 'lucide-react';
import { getExam, updateExam } from '../services/api';
import TeacherLayout from '../components/TeacherLayout';

export default function EditExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    duration_minutes: '',
    total_marks: '',
    start_time: '',
    end_time: '',
  });

  const [examStatus, setExamStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExamData = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await getExam(examId);
      setExamStatus(data.status);

      // Format ISO string to datetime-local (YYYY-MM-DDTHH:MM)
      const formatDT = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setFormData({
        title: data.title || '',
        subject: data.subject || '',
        description: data.description || '',
        duration_minutes: String(data.duration_minutes || ''),
        total_marks: String(data.total_marks || ''),
        start_time: formatDT(data.start_time),
        end_time: formatDT(data.end_time),
      });
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Unable to load exam details.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadExamData();
  }, [loadExamData]);

  const validate = () => {
    const errors = {};
    if (!formData.title.trim() || formData.title.trim().length < 2) {
      errors.title = 'Exam title is required (minimum 2 characters).';
    }
    if (!formData.subject.trim() || formData.subject.trim().length < 2) {
      errors.subject = 'Subject / course code is required (minimum 2 characters).';
    }
    const duration = parseInt(formData.duration_minutes, 10);
    if (isNaN(duration) || duration <= 0) {
      errors.duration_minutes = 'Duration must be a positive integer greater than 0.';
    }
    const marks = parseFloat(formData.total_marks);
    if (isNaN(marks) || marks <= 0) {
      errors.total_marks = 'Total marks must be a positive number greater than 0.';
    }
    if (formData.start_time && formData.end_time) {
      const s = new Date(formData.start_time);
      const e = new Date(formData.end_time);
      if (e <= s) {
        errors.end_time = 'End time must be later than start time.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(null);

    if (examStatus === 'closed') {
      setGlobalError('Closed exams cannot be modified.');
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        duration_minutes: parseInt(formData.duration_minutes, 10),
        total_marks: parseFloat(formData.total_marks),
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };

      await updateExam(examId, payload);
      navigate(`/teacher/exams/${examId}`, {
        state: { notice: 'Exam configuration successfully updated!' },
      });
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Failed to update exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <main id="main-content" className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link
            to={`/teacher/exams/${examId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors mb-3 focus-visible:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Exam Details</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Edit3 className="w-6 h-6 text-indigo-400" aria-hidden="true" />
            Edit Assessment Paper
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Update exam metadata, timings, and scoring specifications.
          </p>
        </div>

        {/* Closed Exam Warning */}
        {examStatus === 'closed' && (
          <div role="alert" className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">This exam is Closed</p>
              <p className="text-xs text-slate-400">Closed exams are immutable and cannot be updated.</p>
            </div>
          </div>
        )}

        {/* Global Error */}
        {globalError && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-rose-200">Update Error</p>
              <p className="text-xs">{globalError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" aria-hidden="true" />
            <span>Loading exam parameters...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-2xl backdrop-blur-sm">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Exam Title <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                disabled={examStatus === 'closed'}
                required
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.title ? 'border-rose-500/80' : 'border-slate-800'
                }`}
              />
              {fieldErrors.title && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fieldErrors.title}</span>
                </p>
              )}
            </div>

            {/* Subject & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="subject" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                  Subject / Course Code <span className="text-rose-400" aria-hidden="true">*</span>
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  disabled={examStatus === 'closed'}
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.subject ? 'border-rose-500/80' : 'border-slate-800'
                  }`}
                />
                {fieldErrors.subject && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{fieldErrors.subject}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="duration_minutes" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                  Duration (in minutes) <span className="text-rose-400" aria-hidden="true">*</span>
                </label>
                <input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="1"
                  disabled={examStatus === 'closed'}
                  required
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.duration_minutes ? 'border-rose-500/80' : 'border-slate-800'
                  }`}
                />
                {fieldErrors.duration_minutes && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{fieldErrors.duration_minutes}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Total Marks */}
            <div>
              <label htmlFor="total_marks" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Total Examination Marks <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="total_marks"
                name="total_marks"
                type="number"
                step="0.5"
                min="1"
                disabled={examStatus === 'closed'}
                required
                value={formData.total_marks}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.total_marks ? 'border-rose-500/80' : 'border-slate-800'
                }`}
              />
              {fieldErrors.total_marks && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fieldErrors.total_marks}</span>
                </p>
              )}
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="start_time" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                  Start Date & Time <span className="text-rose-400" aria-hidden="true">*</span>
                </label>
                <input
                  id="start_time"
                  name="start_time"
                  type="datetime-local"
                  disabled={examStatus === 'closed'}
                  required
                  value={formData.start_time}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.start_time ? 'border-rose-500/80' : 'border-slate-800'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="end_time" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                  End Date & Time <span className="text-rose-400" aria-hidden="true">*</span>
                </label>
                <input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  disabled={examStatus === 'closed'}
                  required
                  value={formData.end_time}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.end_time ? 'border-rose-500/80' : 'border-slate-800'
                  }`}
                />
                {fieldErrors.end_time && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{fieldErrors.end_time}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label htmlFor="description" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Candidate Instructions & Description
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                disabled={examStatus === 'closed'}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link
                to={`/teacher/exams/${examId}`}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || examStatus === 'closed'}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Update Exam</span>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </TeacherLayout>
  );
}
