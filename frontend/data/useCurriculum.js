"use client";

import { useEffect, useState } from "react";
import { curriculum } from "@/data/curriculum";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Merge topics added via the admin PDF pipeline (GET /curriculum-additions)
// into the static curriculum, without mutating the original. Creates missing
// grades/subjects/lessons as needed; skips topics that already exist.
export function mergeAdditions(base, additions) {
  const merged = base.map((g) => ({
    ...g,
    subjects: g.subjects.map((s) => ({
      ...s,
      lessons: (s.lessons || []).map((l) => ({ ...l, topics: [...(l.topics || [])] })),
    })),
  }));

  for (const add of additions || []) {
    if (!add.subject || !add.lesson) continue;

    // Fall back to the first grade if the addition has no grade recorded
    // (records created before the grade field existed) — better than
    // dropping the topic entirely.
    let g = add.grade ? merged.find((x) => x.grade === add.grade) : null;
    if (!g && add.grade) {
      g = { grade: add.grade, subjects: [] };
      merged.push(g);
    }
    if (!g) g = merged[0];
    if (!g) continue;

    let s = g.subjects.find((x) => x.subject === add.subject);
    if (!s) {
      s = { subject: add.subject, lessons: [] };
      g.subjects.push(s);
    }

    let l = s.lessons.find((x) => x.name === add.lesson);
    if (!l) {
      l = { name: add.lesson, topics: [] };
      s.lessons.push(l);
    }

    for (const t of add.topics || []) {
      if (t && !l.topics.includes(t)) l.topics.push(t);
    }
  }

  return merged;
}

// Returns the static curriculum immediately, then re-renders with admin-added
// topics merged in once /curriculum-additions responds. Pages keep working
// unchanged (with the static data) if the backend is unreachable.
export function useMergedCurriculum() {
  const [data, setData] = useState(curriculum);

  useEffect(() => {
    const studentId = localStorage.getItem("student_id") || "";
    fetch(`${BACKEND}/curriculum-additions?student_id=${encodeURIComponent(studentId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.additions) && d.additions.length > 0) {
          setData(mergeAdditions(curriculum, d.additions));
        }
      })
      .catch(() => {});
  }, []);

  return data;
}

// Same lookup semantics as curriculum.js's findSubjectByGrade/findSubject,
// but against a merged dataset instead of the static import.
export function findSubjectIn(data, subjectName, gradeName) {
  if (gradeName) {
    const grade = data.find((g) => g.grade === gradeName);
    return grade ? grade.subjects.find((s) => s.subject === subjectName) || null : null;
  }
  for (const grade of data) {
    const found = grade.subjects.find((s) => s.subject === subjectName);
    if (found) return found;
  }
  return null;
}
