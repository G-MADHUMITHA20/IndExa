import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  HelpCircle,
  PlusCircle,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Send,
  X,
  Loader2,
  Award,
  Layers,
  FileQuestion,
  Calculator,
  AlignLeft,
  FileText,
} from 'lucide-react';
import {
  getExam,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  publishExam,
} from '../services/api';
import TeacherLayout from '../components/TeacherLayout';
import StatusBadge from '../components/StatusBadge';

export default function QuestionManagementPage() {
  const { examId } = useParams();
  const location = useLocation();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(location.state?.notice || null);

  // Question modal / form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // null if adding new
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Question form data
  const [questionData, setQuestionData] = useState({
    question_text: '',
    question_type: 'mcq',
    marks: '10',
    is_required: true,
    options: ['', ''],
    correct_answer: '',
    expected_answer: '',
  });

  // Reorder processing state
  const [isReordering, setIsReordering] = useState(false);

  const loadExamDetails = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await getExam(examId);
      setExam(data);
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Unable to retrieve exam questions.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadExamDetails();
  }, [loadExamDetails]);

  // Open modal for new question
  const handleOpenAddModal = () => {
    setEditingQuestion(null);
    setQuestionData({
      question_text: '',
      question_type: 'mcq',
      marks: '10',
      is_required: true,
      options: ['', ''],
      correct_answer: '',
      expected_answer: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing existing question
  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    setQuestionData({
      question_text: q.question_text || '',
      question_type: q.question_type || 'mcq',
      marks: String(q.marks || 10),
      is_required: q.is_required !== false,
      options: q.options && q.options.length >= 2 ? [...q.options] : ['', ''],
      correct_answer: q.correct_answer || '',
      expected_answer: q.expected_answer || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Dynamic MCQ option handlers
  const handleAddOption = () => {
    setQuestionData((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  };

  const handleRemoveOption = (indexToRemove) => {
    if (questionData.options.length <= 2) {
      setFormErrors((prev) => ({ ...prev, options: 'At least two options are required for MCQ.' }));
      return;
    }
    const updated = questionData.options.filter((_, idx) => idx !== indexToRemove);
    setQuestionData((prev) => ({
      ...prev,
      options: updated,
      // If deleted option was selected as correct answer, reset correct answer
      correct_answer: prev.options[indexToRemove] === prev.correct_answer ? '' : prev.correct_answer,
    }));
  };

  const handleOptionChange = (idx, value) => {
    const updated = [...questionData.options];
    const oldValue = updated[idx];
    updated[idx] = value;
    setQuestionData((prev) => ({
      ...prev,
      options: updated,
      correct_answer: prev.correct_answer === oldValue ? value : prev.correct_answer,
    }));
  };

  // Validate question form
  const validateForm = () => {
    const errors = {};
    if (!questionData.question_text.trim()) {
      errors.question_text = 'Question prompt text cannot be empty.';
    }
    const marksNum = parseFloat(questionData.marks);
    if (isNaN(marksNum) || marksNum <= 0) {
      errors.marks = 'Marks must be a positive number.';
    }

    if (questionData.question_type === 'mcq') {
      const validOptions = questionData.options.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        errors.options = 'MCQ questions require at least two non-empty options.';
      }
      if (!questionData.correct_answer || !questionData.correct_answer.trim()) {
        errors.correct_answer = 'Please select a correct answer option.';
      } else if (!validOptions.includes(questionData.correct_answer.trim())) {
        errors.correct_answer = 'Selected correct answer must match one of the non-empty options.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Question Submit (Add or Edit)
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        question_text: questionData.question_text.trim(),
        question_type: questionData.question_type,
        marks: parseFloat(questionData.marks),
        is_required: questionData.is_required,
        options: questionData.question_type === 'mcq'
          ? questionData.options.map((o) => o.trim()).filter(Boolean)
          : undefined,
        correct_answer: questionData.question_type === 'mcq'
          ? questionData.correct_answer.trim()
          : undefined,
        expected_answer: questionData.expected_answer.trim() || undefined,
      };

      if (editingQuestion) {
        await updateQuestion(examId, editingQuestion.id, payload);
        setSuccessMsg('Question updated successfully.');
      } else {
        await addQuestion(examId, payload);
        setSuccessMsg('New question added to exam.');
      }

      setIsModalOpen(false);
      await loadExamDetails();
    } catch (err) {
      setFormErrors((prev) => ({
        ...prev,
        submit: err.response?.data?.detail || err.message || 'Failed to save question.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (questionId, textSnippet) => {
    if (!window.confirm(`Are you sure you want to delete question "${textSnippet.slice(0, 30)}..."?`)) {
      return;
    }

    try {
      await deleteQuestion(examId, questionId);
      setSuccessMsg('Question deleted.');
      await loadExamDetails();
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Failed to delete question.');
    }
  };

  // Move Question Up / Down
  const handleMoveQuestion = async (index, direction) => {
    if (!exam || !exam.questions) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exam.questions.length) return;

    setIsReordering(true);
    const newQuestions = [...exam.questions];
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    const orderedIds = newQuestions.map((q) => q.id);

    try {
      await reorderQuestions(examId, orderedIds);
      await loadExamDetails();
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Failed to reorder questions.');
    } finally {
      setIsReordering(false);
    }
  };

  // Publish from Question page
  const handlePublishExam = async () => {
    try {
      await publishExam(examId);
      setSuccessMsg('Exam published successfully!');
      await loadExamDetails();
    } catch (err) {
      setGlobalError(err.response?.data?.detail || err.message || 'Cannot publish exam.');
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" aria-hidden="true" />
          <span>Loading question management workspace...</span>
        </div>
      </TeacherLayout>
    );
  }

  if (globalError && !exam) {
    return (
      <TeacherLayout>
        <div className="max-w-xl mx-auto py-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white">Error Loading Exam</h2>
          <p className="text-sm text-slate-400">{globalError}</p>
          <Link
            to="/teacher/exams"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Exam List</span>
          </Link>
        </div>
      </TeacherLayout>
    );
  }

  const marksDifference = exam.total_marks - exam.current_marks_total;
  const marksMatch = Math.abs(marksDifference) < 0.001;
  const canPublish = exam.status === 'draft' && marksMatch && exam.questions.length > 0;

  return (
    <TeacherLayout>
      <main id="main-content" className="space-y-6">
        {/* Navigation & Title */}
        <div>
          <Link
            to={`/teacher/exams/${examId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors mb-2 focus-visible:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Exam Details</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={exam.status} />
                <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
                  {exam.subject}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Question Management: {exam.title}
              </h1>
            </div>

            {exam.status === 'draft' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Add Question</span>
                </button>

                {canPublish && (
                  <button
                    onClick={handlePublishExam}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Publish Exam</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div role="status" className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-400 hover:text-emerald-200 underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {globalError && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-xs text-rose-400 hover:text-rose-200 underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Marks Consistency Indicator Bar */}
        <section
          aria-labelledby="marks-tally-heading"
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            marksMatch
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                marksMatch ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              <Award className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="marks-tally-heading" className="text-sm font-bold text-white flex items-center gap-2">
                <span>Marks Tally:</span>
                <span className="font-mono text-base">
                  {exam.current_marks_total} / {exam.total_marks} Marks
                </span>
                {marksMatch ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Balanced & Ready
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Mismatch ({Math.abs(marksDifference)} marks {marksDifference > 0 ? 'remaining' : 'exceeded'})
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {marksMatch
                  ? 'All question marks match the exam total requirement. The exam is eligible for publishing.'
                  : `Publishing requires question marks sum (${exam.current_marks_total}) to exactly equal the total marks (${exam.total_marks}).`}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 shrink-0 font-medium">
            Total Questions: <strong className="text-white font-mono">{exam.questions.length}</strong>
          </div>
        </section>

        {/* Question List */}
        <section aria-labelledby="question-list-heading" className="space-y-4">
          <h2 id="question-list-heading" className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            Exam Questions ({exam.questions.length})
          </h2>

          {exam.questions.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <FileQuestion className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-white">No questions added to this exam</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add multiple-choice, short-answer, long-answer, or mathematical questions to build the assessment.
              </p>
              {exam.status === 'draft' && (
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold mt-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Add First Question</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {exam.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-lg backdrop-blur-sm"
                >
                  <div className="space-y-3 flex-1">
                    {/* Header line */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs">
                        Q{idx + 1}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs capitalize flex items-center gap-1">
                        {q.question_type === 'mcq' && <FileQuestion className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />}
                        {q.question_type === 'short_answer' && <AlignLeft className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />}
                        {q.question_type === 'long_answer' && <FileText className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
                        {q.question_type === 'mathematical' && <Calculator className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />}
                        <span>{q.question_type.replace('_', ' ')}</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-semibold text-xs border border-emerald-500/20">
                        {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      </span>
                      {q.is_required && (
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Required
                        </span>
                      )}
                    </div>

                    {/* Question Prompt */}
                    <p className="text-sm font-medium text-slate-100 whitespace-pre-line leading-relaxed">
                      {q.question_text}
                    </p>

                    {/* MCQ Options Display */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = opt === q.correct_answer;
                          return (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-xl text-xs font-mono flex items-center justify-between border ${
                                isCorrect
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-950/70 text-slate-400 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-bold text-slate-300 shrink-0">
                                  {String.fromCharCode(65 + oIdx)}.
                                </span>
                                <span className="truncate">{opt}</span>
                              </div>
                              {isCorrect && (
                                <span className="text-[10px] font-bold text-emerald-400 shrink-0 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Teacher private expected answer guidance */}
                    {q.expected_answer && (
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400">
                        <strong className="text-purple-400 block mb-0.5 font-semibold">
                          Instructor Evaluation Guidance (Private):
                        </strong>
                        <p className="italic text-slate-300 whitespace-pre-line">{q.expected_answer}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions & Reordering (Only in draft) */}
                  {exam.status === 'draft' && (
                    <div className="flex md:flex-col items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                      <div className="inline-flex md:flex-col items-center gap-1">
                        <button
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          disabled={idx === 0 || isReordering}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          aria-label={`Move question ${idx + 1} up`}
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          disabled={idx === exam.questions.length - 1 || isReordering}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          aria-label={`Move question ${idx + 1} down`}
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        aria-label={`Edit question ${idx + 1}`}
                        title="Edit Question"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        onClick={() => handleDeleteQuestion(q.id, q.question_text)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        aria-label={`Delete question ${idx + 1}`}
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add/Edit Question Modal */}
        {isModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          >
            <div className="w-full max-w-2xl my-8 rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 id="question-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                  <span>{editingQuestion ? 'Edit Question' : 'Add New Question'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {/* Error banner inside modal */}
              {formErrors.submit && (
                <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {formErrors.submit}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmitQuestion} noValidate className="space-y-5">
                {/* Type & Marks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="question_type" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Question Type <span className="text-rose-400" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="question_type"
                      value={questionData.question_type}
                      onChange={(e) =>
                        setQuestionData((prev) => ({ ...prev, question_type: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="long_answer">Long Answer</option>
                      <option value="mathematical">Mathematical Expression</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="marks" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Allocated Marks <span className="text-rose-400" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="marks"
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={questionData.marks}
                      onChange={(e) => setQuestionData((prev) => ({ ...prev, marks: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {formErrors.marks && (
                      <p className="text-xs text-rose-400 mt-1">{formErrors.marks}</p>
                    )}
                  </div>
                </div>

                {/* Question Prompt */}
                <div>
                  <label htmlFor="question_text" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Question Prompt / Text <span className="text-rose-400" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="question_text"
                    rows="3"
                    required
                    value={questionData.question_text}
                    onChange={(e) =>
                      setQuestionData((prev) => ({ ...prev, question_text: e.target.value }))
                    }
                    placeholder={
                      questionData.question_type === 'mathematical'
                        ? 'Enter expression, e.g.: Evaluate the derivative of f(x) = 3x^2 + 5x - 7'
                        : 'Enter the question prompt clearly...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {questionData.question_type === 'mathematical' && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Mathematical expressions are preserved as formatted text for universal accessibility.
                    </p>
                  )}
                  {formErrors.question_text && (
                    <p className="text-xs text-rose-400 mt-1">{formErrors.question_text}</p>
                  )}
                </div>

                {/* MCQ Options Configuration */}
                {questionData.question_type === 'mcq' && (
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        Answer Options & Correct Answer Selection
                      </span>
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add Option</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Provide at least two options and click the radio button to select the correct answer.
                    </p>

                    <div className="space-y-2">
                      {questionData.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="correct_answer_choice"
                              checked={Boolean(opt && opt === questionData.correct_answer)}
                              onChange={() =>
                                setQuestionData((prev) => ({ ...prev, correct_answer: opt }))
                              }
                              disabled={!opt.trim()}
                              className="accent-emerald-500 w-4 h-4"
                              aria-label={`Mark option ${String.fromCharCode(65 + oIdx)} as correct answer`}
                            />
                            <span className="font-mono text-xs font-bold text-slate-300 w-5">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                          </label>

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />

                          {questionData.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(oIdx)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                              aria-label={`Remove option ${String.fromCharCode(65 + oIdx)}`}
                            >
                              <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {formErrors.options && (
                      <p className="text-xs text-rose-400 mt-1">{formErrors.options}</p>
                    )}
                    {formErrors.correct_answer && (
                      <p className="text-xs text-rose-400 mt-1">{formErrors.correct_answer}</p>
                    )}
                  </div>
                )}

                {/* Expected Answer / Guidance for Short, Long, Math */}
                {questionData.question_type !== 'mcq' && (
                  <div>
                    <label htmlFor="expected_answer" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Expected Answer or Evaluation Guidance{' '}
                      <span className="text-[11px] text-purple-400 font-normal">
                        (Private: Only visible to faculty evaluators)
                      </span>
                    </label>
                    <textarea
                      id="expected_answer"
                      rows="2"
                      value={questionData.expected_answer}
                      onChange={(e) =>
                        setQuestionData((prev) => ({ ...prev, expected_answer: e.target.value }))
                      }
                      placeholder="Guidance for grading or reference answer solution..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingQuestion ? 'Update Question' : 'Add Question'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </TeacherLayout>
  );
}
