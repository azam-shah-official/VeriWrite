/**
 * Local Sample Student Assignments Dataset
 *
 * NOTE: This is clearly identified local sample data used for the Student Dashboard UI
 * until the backend assignment submission & analysis endpoints are connected.
 * Do not treat these entries as live backend records or definitive AI authorship scores.
 */

export const SAMPLE_STUDENT_ASSIGNMENTS = [
  {
    id: "sub-2024-014",
    title: "Ethics in AI & Neural Decision Systems",
    course: "CS-402 • Artificial Intelligence Ethics",
    submittedDate: "Oct 24, 2024",
    wordCount: 3420,
    fileName: "ethics_in_ai_neural_decision_systems.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: true,
    summaryNote:
      "Writing structure and revision history have been processed. Instructor review is complete with no further action required.",
  },
  {
    id: "sub-2024-013",
    title: "Comparative Literature Thesis: Ch. 3",
    course: "LIT-310 • Modern Comparative Literature",
    submittedDate: "Oct 22, 2024",
    wordCount: 4850,
    fileName: "comparative_lit_thesis_ch3.docx",
    analysisStatus: "Completed",
    reviewStatus: "Needs Human Review",
    isRecent: true,
    summaryNote:
      "Automated linguistic analysis is complete. Flagged stylistic transitions have been queued for contextual human review by your instructor.",
  },
  {
    id: "sub-2024-012",
    title: "Quantum Cryptography Term Paper",
    course: "PHYS-450 • Quantum Information Science",
    submittedDate: "Oct 20, 2024",
    wordCount: 2910,
    fileName: "quantum_cryptography_term_paper.pdf",
    analysisStatus: "Pending",
    reviewStatus: "Pending",
    isRecent: true,
    summaryNote:
      "Submission is queued for structural writing analysis. Instructor review will begin once initial processing completes.",
  },
  {
    id: "sub-2024-011",
    title: "Cognitive Computing & Linguistics",
    course: "LING-380 • Computational Linguistics",
    submittedDate: "Oct 15, 2024",
    wordCount: 3180,
    fileName: "cognitive_computing_linguistics.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: true,
    summaryNote:
      "Evidence-based writing analysis and instructor verification are both completed.",
  },
  {
    id: "sub-2024-010",
    title: "Distributed Consensus Protocols Review",
    course: "CS-415 • Distributed Systems",
    submittedDate: "Oct 10, 2024",
    wordCount: 2640,
    fileName: "distributed_consensus_protocols.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-009",
    title: "Epistemology of Scientific Models",
    course: "PHIL-290 • Philosophy of Science",
    submittedDate: "Oct 05, 2024",
    wordCount: 2150,
    fileName: "epistemology_scientific_models.docx",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-008",
    title: "Algorithmic Fairness in Healthcare Triage",
    course: "CS-402 • Artificial Intelligence Ethics",
    submittedDate: "Sep 29, 2024",
    wordCount: 3690,
    fileName: "algorithmic_fairness_healthcare.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-007",
    title: "Post-Colonial Narrative Structures Essay",
    course: "LIT-310 • Modern Comparative Literature",
    submittedDate: "Sep 24, 2024",
    wordCount: 2430,
    fileName: "post_colonial_narrative_structures.docx",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-006",
    title: "Bell's Theorem & Entanglement Lab Report",
    course: "PHYS-450 • Quantum Information Science",
    submittedDate: "Sep 19, 2024",
    wordCount: 1980,
    fileName: "bells_theorem_lab_report.pdf",
    analysisStatus: "Pending",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Supplementary appendix is awaiting re-indexing; primary lab report was reviewed by instructor.",
  },
  {
    id: "sub-2024-005",
    title: "Syntactic Parsing in Low-Resource Languages",
    course: "LING-380 • Computational Linguistics",
    submittedDate: "Sep 14, 2024",
    wordCount: 2875,
    fileName: "syntactic_parsing_low_resource.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-004",
    title: "Byzantine Fault Tolerance Case Study",
    course: "CS-415 • Distributed Systems",
    submittedDate: "Sep 08, 2024",
    wordCount: 2310,
    fileName: "byzantine_fault_tolerance_case_study.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-003",
    title: "Pragmatics & Discourse Coherence Paper",
    course: "LING-380 • Computational Linguistics",
    submittedDate: "Sep 02, 2024",
    wordCount: 2540,
    fileName: "pragmatics_discourse_coherence.docx",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
  {
    id: "sub-2024-002",
    title: "Lattice-Based Post-Quantum Signatures",
    course: "PHYS-450 • Quantum Information Science",
    submittedDate: "Aug 27, 2024",
    wordCount: 3120,
    fileName: "lattice_post_quantum_signatures.pdf",
    analysisStatus: "Pending",
    reviewStatus: "Pending",
    isRecent: false,
    summaryNote:
      "Awaiting batch analysis and faculty review.",
  },
  {
    id: "sub-2024-001",
    title: "Foundations of Moral Agency in Autonomous Agents",
    course: "CS-402 • Artificial Intelligence Ethics",
    submittedDate: "Aug 20, 2024",
    wordCount: 2760,
    fileName: "moral_agency_autonomous_agents.pdf",
    analysisStatus: "Completed",
    reviewStatus: "Completed",
    isRecent: false,
    summaryNote:
      "Writing analysis and faculty review completed.",
  },
];

/**
 * Dynamically calculates Student Dashboard statistics from an assignments array.
 */
export const calculateAssignmentStats = (assignments = []) => {
  const safeList = Array.isArray(assignments) ? assignments : [];

  const totalSubmitted = safeList.length;

  const completedAnalyses = safeList.filter(
    (item) => item.analysisStatus === "Completed"
  ).length;

  const pendingReviews = safeList.filter(
    (item) =>
      item.reviewStatus === "Pending" ||
      item.reviewStatus === "Needs Human Review"
  ).length;

  const recentAssignments = safeList.slice(0, 4);

  return {
    totalSubmitted,
    completedAnalyses,
    pendingReviews,
    recentAssignments,
  };
};
