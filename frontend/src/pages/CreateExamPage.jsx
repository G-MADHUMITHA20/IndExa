import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  PlusCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { createExam } from '../services/api';
import TeacherLayout from '../components/TeacherLayout';

export default function CreateExamPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDefault = new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString().slice(0, 16);
    const endDefault = new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString().slice(0, 16);
    return {
      title: '',
      subject: '',
      description: '',
      duration_minutes: '60',
      total_marks: '100',
      start_time: startDefault,
      end_time: endDefault,
    };
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!formData.start_time) {
      errors.start_time = 'Start date and time is required.';
    }
    if (!formData.end_time) {
      errors.end_time = 'End date and time is required.';
    }
    if (formData.start_time && formData.end_time) {
      const s = new Date(formData.start_time);
      const e = new Date(formData.end_time);
      if (isNaN(s.getTime())) {
        errors.start_time = 'Invalid start date format.';
      }
      if (isNaN(e.getTime())) {
        errors.end_time = 'Invalid end date format.';
      }
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e <= s) {
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

      const created = await createExam(payload);
      // Navigate to question management page for the newly created exam
      navigate(`/teacher/exams/${created.id}/questions`, {
        state: { notice: 'Exam draft created successfully! Now add questions to your exam.' },
      });
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Failed to create exam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <main id="main-content" className="max-w-3xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div>
          <Link
            to="/teacher/exams"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors mb-3 focus-visible:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Exam Management</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Create Assessment Paper
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure examination schedule, duration, and marks. The exam will be saved as a Draft.
          </p>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-rose-200">Unable to Save Exam</p>
              <p className="text-xs">{globalError}</p>
            </div>
          </div>
        )}

        {/* Form Container */}
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
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Computer Architecture Final Examination"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.title ? 'border-rose-500/80' : 'border-slate-800'
              }`}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            />
            {fieldErrors.title && (
              <p id="title-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{fieldErrors.title}</span>
              </p>
            )}
          </div>

          {/* Subject & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="subject" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Subject / Course Code <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={formData.subject}
                onChange={handleChange}
                placeholder="e.g., CS-301 or Algorithms"
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.subject ? 'border-rose-500/80' : 'border-slate-800'
                }`}
                aria-invalid={Boolean(fieldErrors.subject)}
                aria-describedby={fieldErrors.subject ? 'subject-error' : undefined}
              />
              {fieldErrors.subject && (
                <p id="subject-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.subject}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="duration_minutes" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Duration (in minutes) <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="1"
                  required
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  placeholder="60"
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.duration_minutes ? 'border-rose-500/80' : 'border-slate-800'
                  }`}
                  aria-invalid={Boolean(fieldErrors.duration_minutes)}
                  aria-describedby={fieldErrors.duration_minutes ? 'duration-error' : undefined}
                />
              </div>
              {fieldErrors.duration_minutes && (
                <p id="duration-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
              required
              value={formData.total_marks}
              onChange={handleChange}
              placeholder="100"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.total_marks ? 'border-rose-500/80' : 'border-slate-800'
              }`}
              aria-invalid={Boolean(fieldErrors.total_marks)}
              aria-describedby={fieldErrors.total_marks ? 'marks-error' : undefined}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Note: The sum of all individual question marks must equal this total before the exam can be published.
            </p>
            {fieldErrors.total_marks && (
              <p id="marks-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{fieldErrors.total_marks}</span>
              </p>
            )}
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="start_time" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                Start Date & Time <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="start_time"
                name="start_time"
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.start_time ? 'border-rose-500/80' : 'border-slate-800'
                }`}
                aria-invalid={Boolean(fieldErrors.start_time)}
                aria-describedby={fieldErrors.start_time ? 'start-error' : undefined}
              />
              {fieldErrors.start_time && (
                <p id="start-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.start_time}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="end_time" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                End Date & Time <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="end_time"
                name="end_time"
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.end_time ? 'border-rose-500/80' : 'border-slate-800'
                }`}
                aria-invalid={Boolean(fieldErrors.end_time)}
                aria-describedby={fieldErrors.end_time ? 'end-error' : undefined}
              />
              {fieldErrors.end_time && (
                <p id="end-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.end_time}</span>
                </p>
              )}
            </div>
          </div>

          {/* Description / Instructions */}
          <div>
            <label htmlFor="description" className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
              Candidate Instructions & Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g., Read each question carefully. Calculators are permitted. Time management is essential."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Link
              to="/teacher/exams"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Saving Draft...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Create Exam & Add Questions</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </TeacherLayout>
  );
}
